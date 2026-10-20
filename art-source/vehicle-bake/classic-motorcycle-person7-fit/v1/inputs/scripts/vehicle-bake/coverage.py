"""Read-only upper-wheel coverage evidence from actual GLB fixed geometry.

Blender background CLI (no pip dependencies):
  blender --background --factory-startup --threads 4 --python-exit-code 1 \
    --python scripts/vehicle-bake/coverage.py -- \
    --input public/demos/vehicle-bake/a-reduced-projection/budget-mid/model.glb \
    --family approach3-coupe --output data/vehicle-bake/coverage-mid.json

Optional --config JSON overrides the declared family region below. All dimensions
are wheel-radius ratios unless named otherwise. A config without --family must
declare every DEFAULT_REGION key. --input also accepts a retained .blend for
source diagnosis; the coupe source's *_Roll_Y names are an explicit family rule.

This is sampled vertical geometric coverage, NOT collision clearance, a universal
vehicle standard, elevated-view occlusion, silhouette quality, or art approval.
Broad ugly semicircular covers can score perfectly. Keep the existing clearance
proof and actual native/game-view review as separate gates.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_REGION={
    'name':'approach3-coupe-central-crown-v1',
    'longitudinalFractionsR':[-.60,-.30,0.,.30,.60],
    'treadFractions':[-.75,-.375,0.,.375,.75],
    'treadCenterOutwardR':.02/.34,
    'treadHalfWidthR':.082/.34,
    'minimumComponentAxialSpanR':.35,
    'minimumComponentAreaR2':.20,
    'minimumAbsNormalZ':.25,
    'supportHalfWidthR':.15,
    'supportFractions':[-1.,-.5,0.,.5,1.],
    'maximumRayDistanceR':4.,
    'expectedCoveredFraction':1.,
    'sourceRollSuffix':'_Roll_Y',
}

def path_arg(value):
    p=Path(value)
    return p.resolve() if p.is_absolute() else (ROOT/p).resolve()

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def geometry(obj,deps):
    evaluated=obj.evaluated_get(deps)
    mesh=evaluated.to_mesh()
    mesh.calc_loop_triangles()
    verts=[obj.matrix_world@v.co for v in mesh.vertices]
    tris=[tuple(t.vertices) for t in mesh.loop_triangles]
    evaluated.to_mesh_clear()
    return verts,tris

class Rays:
    def __init__(self,triangles):
        self.triangles=triangles
        self.bvh=BVHTree.FromPolygons(
            [p for t in triangles for p in t['points']],
            [(i*3,i*3+1,i*3+2) for i in range(len(triangles))],
            all_triangles=True) if triangles else None

    def hit(self,point,up,limit):
        if self.bvh is None:return None
        p,n,i,d=self.bvh.ray_cast(point,Vector((0,0,1 if up else -1)),limit)
        if p is None:return None
        t=self.triangles[i]
        return {'z':float(p.z),'distance':float(d),'component':t['component'],
                'normalAbsZ':float(abs(n.z))}

    def nearest_distance(self,point):
        if self.bvh is None:return None
        p,n,i,d=self.bvh.find_nearest(point)
        return float(d) if p is not None else None

def fixed_components(objects,deps,radius,region):
    """Weld duplicate UV/normal vertices, then find actual connected components.

    Keep objects separate. glTF-consolidated bodies are split into components;
    narrow arch tubes then cannot masquerade as the broad coachwork component.
    Local support probes also reject narrow protrusions connected to a broad mesh.
    """
    triangles=[];components=[];epsilon=max(1e-8,radius*1e-5)
    for obj in objects:
        vv,ff=geometry(obj,deps)
        welded={};ids=[]
        for v in vv:
            key=tuple(round(c/epsilon) for c in v)
            if key not in welded:welded[key]=len(welded)
            ids.append(welded[key])
        parents=list(range(len(welded)))
        def find(i):
            while parents[i]!=i:
                parents[i]=parents[parents[i]];i=parents[i]
            return i
        def union(a,b):
            a,b=find(a),find(b)
            if a!=b:parents[b]=a
        for f in ff:
            union(ids[f[0]],ids[f[1]]);union(ids[f[0]],ids[f[2]])
        groups={}
        for f in ff:groups.setdefault(find(ids[f[0]]),[]).append([vv[i] for i in f])
        for group in groups.values():
            points=[v for t in group for v in t]
            low=[min(v[k] for v in points) for k in range(3)]
            high=[max(v[k] for v in points) for k in range(3)]
            area=sum((t[1]-t[0]).cross(t[2]-t[0]).length*.5 for t in group)
            broad=(high[1]-low[1]>=radius*region['minimumComponentAxialSpanR']
                   and area>=radius**2*region['minimumComponentAreaR2'])
            ci=len(components)
            components.append({'id':ci,'object':obj.name,'triangles':len(group),
                               'boundsMin':low,'boundsMax':high,
                               'axialSpanR':(high[1]-low[1])/radius,
                               'areaR2':area/radius**2,'broadComponent':broad})
            for t in group:
                normal=(t[1]-t[0]).cross(t[2]-t[0])
                nz=abs(normal.normalized().z) if normal.length else 0
                triangles.append({'points':t,'component':ci,
                                  'panelEligible':broad and nz>=region['minimumAbsNormalZ']})
    return triangles,components

def sample_wheel(wheel,all_rays,panel_rays,region):
    center=wheel['center'];r=wheel['radius'];side=1 if center.y>=0 else -1
    epsilon=max(r*1e-6,1e-8);limit=r*region['maximumRayDistanceR'];samples=[]
    for xf in region['longitudinalFractionsR']:
        if abs(xf)>=1:raise ValueError('Longitudinal samples must be inside (-1,1) radii')
        x=center.x+xf*r;z=center.z+math.sqrt(r*r-(xf*r)**2)
        for tf in region['treadFractions']:
            y=center.y+side*r*(region['treadCenterOutwardR']+tf*region['treadHalfWidthR'])
            point=Vector((x,y,z));start=point+Vector((0,0,epsilon))
            raw=all_rays.hit(start,True,limit);panel=panel_rays.hit(start,True,limit)
            support=[]
            for sf in region['supportFractions']:
                p=start+Vector((0,r*region['supportHalfWidthR']*sf,0))
                support.append(panel_rays.hit(p,True,limit))
            supported=panel is not None and all(hit is not None for hit in support)
            if supported:kind='panel-covered'
            elif panel is not None:kind='insufficient-lateral-support'
            elif raw is not None:kind='trim-or-ineligible-only'
            else:kind='no-overhead-geometry'
            # Signed margin from highest broad surface, including any below tire.
            down=panel_rays.hit(point+Vector((0,0,limit)),False,limit*2)
            margin=down['z']-z if down else None
            sample={'xFractionR':xf,'treadFraction':tf,'pointWorld':list(point),
                    'status':kind,'covered':supported,
                    'rawUpHit':raw,'broadUpHit':panel,
                    'broadVerticalMarginWorld':margin,
                    'broadVerticalMarginR':margin/r if margin is not None else None,
                    'upwardPanelGapWorld':panel['z']-z if panel else None,
                    'supportHits':sum(h is not None for h in support),
                    'supportTests':len(support),
                    'minimumSupportGapWorld':min(h['z']-z for h in support if h) if any(support) else None,
                    'nearestBroadGeometryDistanceWorld':panel_rays.nearest_distance(point)}
            samples.append(sample)
    covered=sum(s['covered'] for s in samples)
    return {'wheel':wheel['name'],'centerWorld':list(center),'radiusWorld':r,
            'actualAxialBoundsWorld':wheel['axialBounds'],
            'samples':samples,'sampleCount':len(samples),'coveredCount':covered,
            'coveredFraction':covered/len(samples),
            'declaredExpectedFraction':region['expectedCoveredFraction'],
            'declaredExpectationMet':covered/len(samples)>=region['expectedCoveredFraction'],
            'uncoveredSamples':[s for s in samples if not s['covered']],
            'rawOnlyCount':sum(s['status']=='trim-or-ineligible-only' for s in samples),
            'unsupportedPanelCount':sum(s['status']=='insufficient-lateral-support' for s in samples)}

def controls(wheels,region,baseline):
    # No actual scene edits: these are isolated in-memory ray-query fixtures.
    empty=Rays([])
    removed=[sample_wheel(w,empty,empty,region)['coveredCount'] for w in wheels]
    fixture=[]
    for i,w in enumerate(wheels):
        c=w['center'];r=w['radius'];z=c.z+1.2*r
        corners=[Vector((c.x+dx*r,c.y+dy*r,z)) for dx,dy in [(-1.5,-1.5),(1.5,-1.5),(1.5,1.5),(-1.5,1.5)]]
        for f in [(0,1,2),(0,2,3)]:fixture.append({'points':[corners[j] for j in f],'component':i,'panelEligible':True})
    canopy=Rays(fixture)
    positive=[sample_wheel(w,canopy,canopy,region)['coveredCount'] for w in wheels]
    shifted=Rays([{**t,'points':[p+Vector((0,100*max(w['radius'] for w in wheels),0)) for p in t['points']]} for t in fixture])
    offset=[sample_wheel(w,shifted,shifted,region)['coveredCount'] for w in wheels]
    total=len(region['longitudinalFractionsR'])*len(region['treadFractions'])
    assert all(n==0 for n in removed) and all(n==total for n in positive) and all(n==0 for n in offset)
    return {'bodyRemovalCoveredCounts':removed,
            'bodyRemovalInformativeAgainstBaseline':any(w['coveredCount'] for w in baseline),
            'syntheticBroadPanelPositiveCounts':positive,
            'sameSyntheticPanelsOffsetOutsideRegionCounts':offset,
            'positiveAndNegativeControlsPassed':True,
            'fixtureIsNotCandidateGeometry':True,
            'meaning':'Controls exercise only ray/support bookkeeping. They deliberately do not approve the canopy silhouette.'}

def inspect(path,region,family):
    before=sha(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.suffix.lower()=='.blend':bpy.ops.wm.open_mainfile(filepath=str(path))
    elif path.suffix.lower() in ('.glb','.gltf'):bpy.ops.import_scene.gltf(filepath=str(path))
    else:raise ValueError('Input must be GLB, glTF or retained Blender source')
    bpy.context.view_layer.update();scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
    rolls=[o for o in scene.objects if 'wheel_radius' in o and 'roll_axis_gltf' in o]
    if not rolls and path.suffix.lower()=='.blend' and family=='approach3-coupe':
        rolls=[o for o in scene.objects if o.name.endswith(region['sourceRollSuffix'])]
    if not rolls:raise ValueError('No declared roll pivots found')
    moving=set();wheels=[]
    for roll in sorted(rolls,key=lambda o:o.name):
        axle=(roll.matrix_world.to_3x3()@Vector((0,1,0))).normalized()
        if abs(axle.dot(Vector((0,1,0))))<.9999:
            raise ValueError(f'{roll.name}: this diagnostic requires neutral Blender-Y axles; normalize the declared family pose first')
        children=[o for o in roll.children_recursive if o.type in ('MESH','CURVE')]
        moving.update(children);vv=[]
        for obj in children:vv.extend(geometry(obj,deps)[0])
        if not vv:raise ValueError(f'Empty wheel {roll.name}')
        center=roll.matrix_world.translation.copy();r=max(math.hypot(v.x-center.x,v.z-center.z) for v in vv)
        wheels.append({'name':roll.name,'center':center,'radius':r,
                       'axialBounds':[min(v.y for v in vv),max(v.y for v in vv)]})
    fixed=[o for o in scene.objects if o.type in ('MESH','CURVE') and o not in moving]
    rr=sorted(w['radius'] for w in wheels)[len(wheels)//2]
    tris,components=fixed_components(fixed,deps,rr,region)
    all_rays=Rays(tris);panel_rays=Rays([t for t in tris if t['panelEligible']])
    results=[sample_wheel(w,all_rays,panel_rays,region) for w in wheels]
    control=controls(wheels,region,results)
    assert sha(path)==before,'Input changed during read-only diagnosis'
    return {'schema':'tilefun-upper-wheel-coverage-evidence-v1','status':'evidence-only',
            'input':str(path),'inputSha256':before,'inputBytesUnchanged':True,
            'axes':'Blender world: longitudinal X, tread/roll axis Y, up +Z',
            'family':family,'region':region,
            'upperEnvelope':'Conservative full-radius neutral-steer swept cylinder; z=c.z+sqrt(r^2-dx^2), at declared tread samples.',
            'panelClassification':'UV/normal splits position-welded before component analysis; minimum axial span + area; abs normal Z threshold; 5 lateral overhead support rays.',
            'bodyComponents':components,'wheels':results,'controls':control,
            'limitations':[
                'Family-specific declared partial footprint, not a universal coverage standard. The default samples central 60% longitudinal radius and central 75% tread half-width.',
                'All metrics are geometry evidence, not art approval. Red semicircular caps can satisfy all coverage samples yet ruin the low continuous sports-car silhouette.',
                'Vertical +Z rays do not prove occlusion from elevated/game cameras, curved tread coverage between samples, steering clearance or collision clearance.',
                'Full-radius cylinder conservatively overestimates toroidal tread radius away from its axial center. Axial sample region is declared from the coupe tire source, not inferred from hub caps.',
                'Connected-component breadth is a heuristic; lateral support probes reduce false acceptance of thin attached trim but finite samples can miss narrow gaps. Report raw hits and component dimensions alongside qualified hits.',
                'Support rays require geometry anywhere overhead within the declared ray range; roof-like or badly humped panels may qualify. Native silhouette and camera-space wheel-ID visibility checks remain necessary.'
            ]}

def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--input',required=True);parser.add_argument('--output',required=True)
    parser.add_argument('--family',choices=['approach3-coupe']);parser.add_argument('--config')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    overrides=json.loads(path_arg(args.config).read_text()) if args.config else {}
    if not args.family and not all(k in overrides for k in DEFAULT_REGION):
        parser.error('Choose --family approach3-coupe or declare a complete --config sample region')
    region={**DEFAULT_REGION,**overrides}
    if not region['supportFractions'] or 0 not in region['supportFractions']:raise ValueError('Support probes must include their center')
    report=inspect(path_arg(args.input),region,args.family or region['name'])
    out=path_arg(args.output)
    if out==path_arg(args.input):raise ValueError('Output must not overwrite input')
    if out.exists():raise FileExistsError(f'Keep prior evidence: choose a new output path ({out})')
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(out),'wheels':[{'wheel':w['wheel'],'covered':w['coveredCount'],'samples':w['sampleCount'],'rawOnly':w['rawOnlyCount'],'unsupported':w['unsupportedPanelCount']} for w in report['wheels']],'controls':report['controls']},indent=2))

if __name__=='__main__':main()

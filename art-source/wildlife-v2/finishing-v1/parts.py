"""The retained animal paint is shared by native and new action poses.

Read-only masters supply coat, face and hoof pixels. Independently evaluated
Blender parts supply motion. No new exterior outline or animation scaling.
"""
from PIL import Image, ImageDraw
from painter import affine_paint, hull, letter_image, polygon, snap, surface_paint, xy


def cut(image, mask):
    selected = image.copy()
    selected.putalpha(Image.composite(image.getchannel('A'), Image.new('L', image.size), mask))
    remainder = image.copy()
    remainder.putalpha(Image.composite(Image.new('L', image.size), image.getchannel('A'), mask))
    return selected, remainder


def shape_mask(size, points):
    mask = Image.new('L', (size, size))
    polygon(ImageDraw.Draw(mask), hull(points), 255)
    return mask


class RetainedParts:
    def __init__(self, species, size, palette, masters, projection, base_sheet):
        self.species, self.size, self.palette = species, size, palette
        self.refs = projection['references']
        self.templates = {}
        cat = species.startswith('cat')
        for facing, ref in self.refs.items():
            for group, anchor in [('bodies', 'body'), ('heads', 'head')]:
                if group in masters:
                    part = masters[group][facing]
                    if 'mirror' in part:
                        part = dict(part, pixels=[row[::-1] for row in masters[group][part['mirror']]['pixels']])
                    image = letter_image(part, palette, size, ref[anchor])
                elif group == 'heads':
                    image = letter_image(dict(pixels=masters['headTemplates'][facing], offset=[-3, -3]), palette, size, ref['head'])
                else:
                    # Variant masters own full native frames. Isolate their original
                    # torso/bib/stripes using their own retained geometry at idle.
                    row = ['down', 'up', 'left', 'right'].index(facing)
                    image = base_sheet.crop((0, row*size, size, (row+1)*size))
                    mask = Image.new('L', (size, size))
                    draw = ImageDraw.Draw(mask)
                    for name in ['torso', 'shoulder', 'pelvis', 'white-bib']:
                        points = hull(ref['volumes'][name]['points'])
                        polygon(draw, points, 255)
                        if len(points) > 2:
                            draw.line(points+[points[0]], fill=255, width=2)
                    image, _ = cut(image, mask)
                self.templates[group, facing] = image
            if species == 'deer':
                # The old body and face planes each contain some neck paint.
                # Give that paint to the actual moving neck, leaving the skull's
                # eye/ear/face markings under its original owner.
                mask = shape_mask(size, ref['neckHull'])
                skull = shape_mask(size, ref['headHull'])
                original = mask.copy()
                for y in range(size):
                    for x in range(size):
                        near = any(0 <= x+dx < size and 0 <= y+dy < size and original.getpixel((x+dx, y+dy))
                                   for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)])
                        mask.putpixel((x, y), 255 if near and y <= ref['neckBase'][1]+1 and not skull.getpixel((x, y)) else 0)
                for group in ['bodies', 'heads']:
                    neck, remainder = cut(self.templates[group, facing], mask)
                    self.templates[group, facing] = remainder
                    self.templates['neck-'+group, facing] = neck
                jaw_mask = shape_mask(size, ref['jawHull'])
                jaw, head = cut(self.templates['heads', facing], jaw_mask)
                self.templates['heads', facing] = head
                self.templates['jaws', facing] = jaw
            if species == 'donkey':
                self.templates['jaws', facing] = letter_image(masters['jaws'][facing], palette, size, ref['jaw'])
        self.cat = cat

    def paint(self, target, group, record, owner=None):
        facing = record['facing']
        ref = self.refs[facing]
        owner = owner or ('body' if group == 'bodies' else 'jaw' if group == 'jaws' else 'head')
        basis_key = 'neckBasis' if owner == 'neckBase' else owner+'Basis'
        paint = affine_paint(self.templates[group, facing], ref[owner], ref[basis_key], record[owner], record[basis_key])
        if paint is None:
            # At a genuinely edge-on plane during the donkey's 3D roll, the
            # mesh's retained source materials own the visible surface.
            volumes = [dict(v, name=name) for name, v in record['volumes'].items()
                       if v.get('group') == owner and v.get('key')]
            paint = surface_paint(self.size, volumes, self.palette)
        target.alpha_composite(paint)

    def legs(self, target, name, contact, near, record):
        palette = self.palette
        points = [xy(p) for p in contact['screen']]
        draw = ImageDraw.Draw(target)
        if self.species == 'donkey':
            radii = [1.7, 1.3, .9, .7, .7]
            normals = []
            for i, point in enumerate(points):
                a, b = points[max(0, i-1)], points[min(len(points)-1, i+1)]
                dx, dy = b[0]-a[0], b[1]-a[1]
                length = (dx*dx+dy*dy)**.5 or 1
                normals.append((-dy/length*radii[i], dx/length*radii[i]))
            contour = [(snap(p[0]+n[0]), snap(p[1]+n[1])) for p, n in zip(points, normals)]
            contour += [(snap(p[0]-n[0]), snap(p[1]-n[1])) for p, n in reversed(list(zip(points, normals)))]
            polygon(draw, contour, palette['B' if near else 'M'])
            draw.line(contour+[contour[0]], fill=palette['K'])
            if near:
                draw.line([(x-1, y) for x, y in points[:3]], fill=palette['H'])
            foot = hull(record['nativeFootHulls'][name])
            polygon(draw, foot, palette['M'])
            draw.line(foot+[foot[0]], fill=palette['K'])
            return
        color = palette['c' if near else 's'] if self.cat else palette['B' if near else 'S']
        for i, (a, b) in enumerate(zip(points, points[1:])):
            draw.line([a, b], fill=color, width=2 if i == 0 else 1)
        x, y = points[-1]
        if self.cat:
            draw.line([(x-1, y), (x, y)], fill=palette['w' if near else 'g'])
            draw.point((x, y+1), fill=palette['k'])
        else:
            group = 'rear' if record['facing'] == 'up' else 'near' if near else 'far'
            part = self.hooves[group]
            hoof = letter_image(part, palette, self.size, [x, y])
            target.alpha_composite(hoof)

    def tail(self, target, record):
        draw = ImageDraw.Draw(target)
        points = [xy(p) for p in record['tail']]
        palette = self.palette
        if self.cat:
            draw.line(points, fill=palette['k'], width=2)
            draw.line(points, fill=palette['c'])
        elif self.species == 'deer':
            draw.line(points, fill=palette['K'], width=4)
            draw.line(points, fill=palette['B'], width=3)
            if record['facing'] == 'up' or record['clip'] == 'stamp':
                a, b = points
                draw.line([((a[0]+b[0])//2, (a[1]+b[1])//2), b], fill=palette['C'], width=2)
            elif record['facing'] in ['left', 'right']:
                draw.point((points[-1][0], points[-1][1]+1), fill=palette['L'])
        else:
            for i, (a, b) in enumerate(zip(points, points[1:])):
                draw.line([a, b], fill=palette['K'], width=4-i)
                draw.line([a, b], fill=palette['B' if i < 2 else 'M'], width=3-i)

    def ears(self, target, record, near):
        if not self.cat:
            return
        draw = ImageDraw.Draw(target)
        names = ['ear--1', 'ear-1']
        for name in sorted(names, key=lambda n: -record['volumes'][n]['depth']):
            volume = record['volumes'][name]
            if (volume['depth'] < record['head'][2]) != near:
                continue
            points = hull(volume['points'])
            polygon(draw, points, self.palette['c'])
            draw.line(points+[points[0]], fill=self.palette['k'])
            if record['facing'] != 'up':
                points = record['volumes']['ear-pink-'+name.removeprefix('ear-')]['points']
                draw.point((snap(sum(p[0] for p in points)/len(points)), snap(sum(p[1] for p in points)/len(points))), fill=self.palette['p'])

    def neck(self, target, record):
        if self.species == 'deer':
            ref = self.refs[record['facing']]
            if sum(abs(record['neckBasis'][i][j]-ref['neckBasis'][i][j]) for i in range(2) for j in range(2)) > .001:
                # A narrow coat-colored bridge closes raster cracks between
                # independently rotating paint parts at grazing angles.
                ImageDraw.Draw(target).line([xy(record['neckBase']), xy(record['head'])], fill=self.palette['B'], width=2)
            for group in ['bodies', 'heads']:
                self.paint(target, 'neck-'+group, record, 'neckBase')
        elif self.species == 'donkey':
            draw = ImageDraw.Draw(target)
            points = [xy(p) for p in record['neck']]
            radius = self.neck_radius*10
            draw.line(points, fill=self.palette['K'], width=snap(radius*2)+1)
            draw.line(points, fill=self.palette['B'], width=snap(radius*2))
            for x, y in points[1:-1]:
                draw.ellipse((snap(x-radius), snap(y-radius), snap(x+radius), snap(y+radius)), fill=self.palette['B'])
            draw.line([(x-1, y) for x, y in points], fill=self.palette['H'])
            if record['facing'] != 'down':
                for volume in record['mane']:
                    polygon(draw, hull(volume['points']), self.palette[volume['key']])

    def compose(self, record):
        image = Image.new('RGBA', (self.size, self.size))
        contacts = sorted(record['contacts'].items(), key=lambda pair: -pair[1]['screen'][0][2])
        up = record['facing'] == 'up'
        if not up or self.species == 'donkey':
            self.tail(image, record)
        self.ears(image, record, False)
        if up:
            self.neck(image, record)
            if self.species in ['deer', 'donkey']:
                self.paint(image, 'jaws', record)
            self.paint(image, 'heads', record)
        for name, contact in contacts[:2]:
            self.legs(image, name, contact, False, record)
        self.paint(image, 'bodies', record)
        for name, contact in contacts[2:]:
            self.legs(image, name, contact, True, record)
        self.paint(image, 'bodies', record)
        if up and self.species != 'donkey':
            self.tail(image, record)
        if not up:
            self.neck(image, record)
            if self.species in ['deer', 'donkey']:
                self.paint(image, 'jaws', record)
            self.paint(image, 'heads', record)
        self.ears(image, record, True)
        return image

// Headless preview of the exported model using the game camera matrix.
export function makeWildlifeCapture({
  THREE,
  gltf,
  sprite,
  config,
  obliqueProjection,
  WILDLIFE_MESHES,
}) {
  const { runtime } = config;
  const reviewRows = runtime.reviewRows ?? [0, 1, 2, 3];
  const actionRow = reviewRows.at(-1);
  const size = [
    Math.max(84, runtime.spriteWidth + 12),
    Math.max(56, Math.ceil(runtime.spriteHeight * (config.stageHeight ?? 0.75))),
  ];
  const anchor = [Math.floor(size[0] / 2), Math.floor(size[1] * 0.7)];
  const heading = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
  const scene = new THREE.Scene();
  const model = gltf.scene;
  scene.add(model);
  const camera = new THREE.Camera();
  const portrait = new THREE.OrthographicCamera(-2.8, 2.8, 1.8, -1.8, 0.01, 40);
  portrait.position.set(4.2, 2.6, 6.5);
  portrait.lookAt(0, config.portraitCenter ?? 0.78, 0);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
  const rigid = config.rigidRuntime && WILDLIFE_MESHES.get(config.runtimeType);
  const fit = config.fit?.slice();
  const pose = new THREE.Euler();
  const rotation = new THREE.Quaternion();
  const rigidParts = [];
  model.traverse((object) => {
    if (object.isSkinnedMesh) object.frustumCulled = false;
    if (!object.isMesh) return;
    if (rigid) rigidParts.push([object, object.quaternion.clone()]);
    if (object.material.map) {
      object.material.map.minFilter = THREE.NearestFilter;
      object.material.map.magFilter = THREE.NearestFilter;
      object.material.map.generateMipmaps = false;
    }
    if (!object.material.isMeshBasicMaterial) {
      object.material = new THREE.MeshBasicMaterial({
        map: object.material.map,
        vertexColors: object.geometry.hasAttribute("color"),
        side: object.material.side,
      });
    }
  });
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const height = bounds.getSize(new THREE.Vector3()).y;
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  const portraitHeight = Math.max(1.58, radius * 1.14);
  portrait.left = (-portraitHeight * 420) / 270;
  portrait.right = -portrait.left;
  portrait.top = portraitHeight;
  portrait.bottom = -portraitHeight;
  portrait.updateProjectionMatrix();
  const rigidScale = rigid ? rigid.height / height : 1;

  function shownFrame(clip, phase) {
    const info = runtime.clips[clip];
    return info.start + Math.min(info.count - 1, Math.floor(phase * info.count));
  }

  function drawModel(clip, phase, row, close = false) {
    if (rigid) {
      for (const [object, base] of rigidParts) {
        pose.set(0, 0, 0);
        rigid.pose?.(object.name, shownFrame(clip, phase), pose);
        object.quaternion.copy(base).multiply(rotation.setFromEuler(pose));
      }
    } else {
      const modelClip = config.modelClips?.[clip] ?? clip;
      const animated = clips.get(modelClip);
      if (!animated) throw Error(`Missing GLB clip ${modelClip}`);
      mixer.stopAllAction();
      const action = mixer.clipAction(animated);
      action.setLoop(THREE.LoopOnce, 1).reset().play();
      action.clampWhenFinished = true;
      mixer.setTime(phase * animated.duration);
    }
    if (close) {
      model.rotation.y = Math.PI;
      model.scale.setScalar(1);
      renderer.setSize(420, 270, false);
      renderer.render(scene, portrait);
      return renderer.domElement;
    }
    model.rotation.y = heading[row];
    if (rigid) {
      model.scale.set(
        rigidScale * (rigid.topDown?.width ?? 1),
        rigidScale * (rigid.topDown?.height ?? 1),
        rigidScale,
      );
    } else {
      model.scale.set(...fit);
    }
    const [sx, , , , , sy, , , , depth, , constant] = obliqueProjection(1, ...size);
    // glTF Y up is game Z. glTF Z is north after the game world-root mirror.
    camera.projectionMatrix.set(
      sx,
      0,
      0,
      0,
      0,
      sy,
      sy,
      1 - (2 * anchor[1]) / size[1],
      0,
      -depth,
      depth,
      constant,
      0,
      0,
      0,
      1,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    renderer.setSize(...size, false);
    renderer.render(scene, camera);
    return renderer.domElement;
  }

  function canvas(width, height, color = "#171f23") {
    const result = document.createElement("canvas");
    result.width = width;
    result.height = height;
    const paint = result.getContext("2d");
    paint.imageSmoothingEnabled = false;
    paint.fillStyle = color;
    paint.fillRect(0, 0, width, height);
    return [result, paint];
  }

  function label(paint, value, x, y, font = "bold 19px system-ui", color = "#f5f0e2") {
    paint.font = font;
    paint.fillStyle = color;
    paint.fillText(value, x, y);
  }

  function field(kind, clip, phase, row, transparent = false) {
    const [result, paint] = canvas(...size, config.ground ?? "#769276");
    const lift = Math.round((config.worldLift?.[clip] ?? 0) * Math.sin(Math.PI * phase) ** 1.5);
    if (transparent) paint.clearRect(0, 0, ...size);
    if (!transparent && !config.water) {
      paint.fillStyle = "#638165";
      paint.beginPath();
      paint.ellipse(anchor[0], anchor[1] + 1, row < 2 ? 4 : 6, 2, 0, 0, Math.PI * 2);
      paint.fill();
    }
    if (kind === "model") {
      paint.drawImage(drawModel(clip, phase, row), 0, -lift);
    } else {
      const [ax, ay] = runtime.anchor;
      const { spriteWidth: w, spriteHeight: h } = runtime;
      const column = shownFrame(clip, phase);
      const spriteRow = runtime.fixedSpriteRow ?? (row < runtime.facings ? row : 0);
      if (column * w >= sprite.width || spriteRow * h >= sprite.height)
        throw Error("Sprite frame outside sheet");
      if (runtime.sideProfile && row === 2) {
        paint.translate(anchor[0] * 2, 0);
        paint.scale(-1, 1);
      }
      paint.drawImage(
        sprite,
        column * w,
        spriteRow * h,
        w,
        h,
        anchor[0] - ax,
        anchor[1] - ay - lift,
        w,
        h,
      );
    }
    return result;
  }

  function footprint(kind, row) {
    const frame = field(kind, config.clips[0], 0, row, true);
    const pixels = frame.getContext("2d").getImageData(0, 0, ...size).data;
    let left = size[0],
      right = -1,
      top = size[1],
      bottom = -1;
    for (let y = 0; y < size[1]; y++) {
      for (let x = 0; x < size[0]; x++) {
        if (pixels[(y * size[0] + x) * 4 + 3] < 192) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left) throw Error(`Empty ${kind} facing ${row}`);
    return {
      left,
      right,
      top,
      width: right + 1 - left,
      height: bottom + 1 - top,
      bottom: bottom - anchor[1],
    };
  }

  if (config.autoFit && fit && !rigid) {
    const clamp = (ratio) => Math.max(0.72, Math.min(1.45, ratio));
    for (const [axis, rows] of [
      [0, [0, 1]],
      [2, [2, 3]],
    ]) {
      const views = rows.filter((row) => reviewRows.includes(row));
      if (!views.length) continue;
      const width = (kind) => views.reduce((sum, row) => sum + footprint(kind, row).width, 0);
      fit[axis] *= clamp(width("sprite") / width("model"));
    }
    fit[1] *= clamp(footprint("sprite", actionRow).height / footprint("model", actionRow).height);
    for (let i = 0; i < fit.length; i++) fit[i] = Math.round(fit[i] * 100) / 100;
  }

  const encode = (canvas) => canvas.toDataURL("image/png").split(",")[1];
  const sides = ["front", "back", "left", "right"];
  function drawContained(paint, frame, crop, x, y, width, height) {
    const scale = Math.min(width / crop[2], height / crop[3]);
    const dw = Math.round(crop[2] * scale);
    const dh = Math.round(crop[3] * scale);
    paint.drawImage(
      frame,
      ...crop,
      x + Math.floor((width - dw) / 2),
      y + Math.floor((height - dh) / 2),
      dw,
      dh,
    );
  }
  const pair = (paint, view, x, y, w, h, gap, clip, phase) => {
    const whole = [0, 0, ...size];
    drawContained(paint, field("sprite", clip, phase, view), whole, x, y, w, h);
    drawContained(paint, field("model", clip, phase, view), whole, x + gap, y, w, h);
  };

  function stills() {
    const output = {};
    const cropWidth = config.crop?.width ?? Math.max(40, Math.ceil(runtime.spriteWidth * 0.61));
    const cropHeight = config.crop?.height ?? Math.max(34, Math.ceil(cropWidth * 0.77));
    let crop = [
      anchor[0] - Math.floor(cropWidth / 2),
      anchor[1] - cropHeight + (config.crop?.belowAnchor ?? 7),
      cropWidth,
      cropHeight,
    ];
    if (config.autoCrop) {
      const views = footprints.flatMap(({ sprite, model }) => [sprite, model]);
      const left = Math.min(anchor[0] - cropWidth / 2, ...views.map((view) => view.left - 4));
      const right = Math.max(anchor[0] + cropWidth / 2, ...views.map((view) => view.right + 4));
      const top = Math.min(anchor[1] - cropHeight + 7, ...views.map((view) => view.top - 4));
      const bottom = Math.max(anchor[1] + 7, ...views.map((view) => anchor[1] + view.bottom + 4));
      crop = [Math.floor(left), top, Math.ceil(right - left), bottom - top];
    }
    const [native, nativePaint] = canvas(2 * size[0], reviewRows.length * size[1]);
    const [appearance, appearancePaint] = canvas(966, 422);
    label(appearancePaint, runtime.name, 25, 48, "bold 34px system-ui");
    const viewLabel =
      reviewRows.length === 4
        ? "Four facings · sprite left, model right"
        : "Sprite left, model right";
    label(appearancePaint, viewLabel, 25, 81);
    label(appearancePaint, "3D close-up", 525, 81);
    const idle = config.clips[0];
    for (const [index, row] of reviewRows.entries()) {
      nativePaint.drawImage(field("sprite", idle, 0, row), 0, index * size[1]);
      nativePaint.drawImage(field("model", idle, 0, row), size[0], index * size[1]);
      const x = 25 + (index % 2) * 242;
      const y = 110 + Math.floor(index / 2) * 138;
      label(appearancePaint, sides[row], x, y, "15px system-ui", "#c4d3c7");
      drawContained(appearancePaint, field("sprite", idle, 0, row), crop, x, y + 7, 112, 95);
      drawContained(appearancePaint, field("model", idle, 0, row), crop, x + 114, y + 7, 112, 95);
    }
    appearancePaint.fillStyle = config.ground ?? "#769276";
    appearancePaint.fillRect(525, 116, 420, 270);
    appearancePaint.drawImage(drawModel(idle, 0.15, 0, true), 525, 116);
    output.appearance = encode(appearance);
    output.native = encode(native);
    for (const clip of config.clips.slice(1)) {
      const [sheet, paint] = canvas(928, 390);
      label(paint, `${runtime.name} · ${clip}`, 20, 51, "bold 32px system-ui");
      label(paint, "Live sprite", 20, 158);
      label(paint, "3D model", 20, 298);
      for (let i = 0; i < 4; i++) {
        const phase = [0, 0.26, 0.53, 0.8][i];
        const x = 145 + i * 190;
        label(paint, `${Math.round(phase * 100)}%`, x, 100, "16px system-ui", "#c4d3c7");
        drawContained(paint, field("sprite", clip, phase, actionRow), crop, x, 112, 176, 115);
        drawContained(paint, field("model", clip, phase, actionRow), crop, x, 246, 176, 115);
      }
      output[clip] = encode(sheet);
    }
    return output;
  }

  function video({ clip, phase, row }) {
    const [frame, paint] = canvas(940, 402);
    label(paint, runtime.name, 28, 43, "bold 32px system-ui");
    label(paint, clip, 730, 42, "22px system-ui", "#c4d3c7");
    label(paint, "Live sprite", 28, 86);
    label(paint, "3D model", 483, 86);
    const facing = config.rollout ? reviewRows[row % reviewRows.length] : actionRow;
    pair(paint, facing, 28, 102, 420, 280, 455, clip, phase);
    if (config.rollout) {
      for (const [i, kind] of ["sprite", "model"].entries()) {
        const x = 28 + i * 455;
        paint.drawImage(field(kind, clip, phase, facing), x, 100);
        label(paint, "1×", x + 4, 116, "13px system-ui");
      }
    }
    return encode(frame);
  }

  const footprints = reviewRows.map((row) => ({
    sprite: footprint("sprite", row),
    model: footprint("model", row),
  }));
  const clipDurations = Object.fromEntries([...clips].map(([name, clip]) => [name, clip.duration]));
  return { stills, video, clipNames: [...clips.keys()], clipDurations, fit, footprints };
}

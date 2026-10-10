/** Procedural rigid wheels: transform the assemblies, leaving the body fixed. */
export function createWheelRig(scene, THREE) {
  const wheels = ["FL", "FR", "RL", "RR"].map((id) => {
    const roll = scene.getObjectByName(`Wheel_${id}_Roll`);
    const steer = scene.getObjectByName(`Wheel_${id}_Steer`);
    if (!roll || !steer || roll.parent !== steer) throw new Error(`Missing wheel assembly ${id}`);
    const radius = roll.userData.wheel_radius;
    const axis = roll.userData.roll_axis_gltf;
    if (!(radius > 0) || !Array.isArray(axis) || axis.length !== 3)
      throw new Error(`Invalid wheel metadata ${id}`);
    return {
      id,
      roll,
      steer,
      radius,
      axis: new THREE.Vector3(...axis).normalize(),
      restRoll: roll.quaternion.clone(),
      restSteer: steer.quaternion.clone(),
    };
  });
  function travel(wheel, distance) {
    if (!Number.isFinite(distance)) throw new Error("Wheel distance must be finite");
    const phase = -distance / wheel.radius;
    wheel.roll.quaternion
      .copy(wheel.restRoll)
      .multiply(new THREE.Quaternion().setFromAxisAngle(wheel.axis, phase));
  }
  return {
    wheels,
    setTravel(distance) {
      for (const wheel of wheels) travel(wheel, distance);
    },
    setWheelTravel(id, distance) {
      const wheel = wheels.find((item) => item.id === id);
      if (!wheel) throw new Error(`Unknown wheel ${id}`);
      travel(wheel, distance);
    },
    setSteering(angle) {
      if (!Number.isFinite(angle)) throw new Error("Steering angle must be finite");
      for (const wheel of wheels) {
        if (!wheel.steer.userData.steering_enabled) continue;
        const axis = new THREE.Vector3(...wheel.steer.userData.steer_axis_gltf).normalize();
        wheel.steer.quaternion
          .copy(wheel.restSteer)
          .multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
      }
    },
  };
}

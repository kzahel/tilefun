const load = async (url) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
};
const [side, travel, sheet] = await Promise.all([
  load('side-frames.webp'), load('travel-frames.webp'), load('sheet.png'),
]);
const canvas = document.querySelector('#study');
const native = document.querySelector('#native');
const ctx = canvas.getContext('2d');
const nc = native.getContext('2d', { willReadFrequently: true });
nc.imageSmoothingEnabled = false;
const view = document.querySelector('#view');
const slider = document.querySelector('#pose');
const speed = document.querySelector('#speed');
const pause = document.querySelector('#pause');
let paused = false, pose = 0, last = performance.now(), carry = 0;
function draw() {
  const width = view.value === 'side' ? 640 : 960;
  canvas.width = width;
  canvas.height = 580;
  ctx.drawImage(view.value === 'side' ? side : travel,
    (pose % 8) * width, Math.floor(pose / 8) * 580, width, 580, 0, 0, width, 580);
  nc.clearRect(0, 0, 320, 80);
  for (let row = 0; row < 4; row++)
    nc.drawImage(sheet, (pose % 32) * 80, row * 80, 80, 80, row * 80, 0, 80, 80);
  slider.value = String(pose);
  document.querySelector('#status').textContent = `${pose + 1} / ${Number(slider.max) + 1}`;
}
function setPaused(value) {
  paused = value;
  pause.textContent = value ? 'Play' : 'Pause';
  carry = 0;
}
view.addEventListener('change', () => {
  slider.max = view.value === 'side' ? '31' : '63';
  pose = 0;
  carry = 0;
  draw();
});
slider.addEventListener('input', () => { setPaused(true); pose = Number(slider.value); draw(); });
pause.addEventListener('click', () => setPaused(!paused));
document.querySelector('#step').addEventListener('click', () => {
  setPaused(true);
  pose = (pose + 1) % (Number(slider.max) + 1);
  draw();
});
window.horseMotionStudy = {
  ready: true,
  inspect(index, mode = 'side') {
    if (!['side', 'travel'].includes(mode) || index < 0 || index >= (mode === 'side' ? 32 : 64)) throw Error('Unknown pose');
    view.value = mode;
    slider.max = mode === 'side' ? '31' : '63';
    setPaused(true);
    pose = index;
    draw();
  },
};
function tick(now) {
  if (!paused) {
    carry += (now - last) * Number(speed.value);
    if (carry >= 50) {
      const steps = Math.floor(carry / 50);
      pose = (pose + steps) % (Number(slider.max) + 1);
      carry -= steps * 50;
      draw();
    }
  }
  last = now;
  requestAnimationFrame(tick);
}
draw();
requestAnimationFrame(tick);

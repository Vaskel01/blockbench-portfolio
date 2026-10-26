// Camp audio built from Minecraft 1.21.1's own sound events (see assets/minecraft/SOURCES.md): campfire
// crackles as ambience, plus chest, fire-charge, XP-orb and button-click cues.
// Sound starts muted and only unlocks after a user gesture; the choice is remembered per browser.
import crackle1 from '../../assets/minecraft/sounds/block/campfire/crackle1.ogg';
import crackle2 from '../../assets/minecraft/sounds/block/campfire/crackle2.ogg';
import crackle3 from '../../assets/minecraft/sounds/block/campfire/crackle3.ogg';
import crackle4 from '../../assets/minecraft/sounds/block/campfire/crackle4.ogg';
import crackle5 from '../../assets/minecraft/sounds/block/campfire/crackle5.ogg';
import crackle6 from '../../assets/minecraft/sounds/block/campfire/crackle6.ogg';
import chestOpen from '../../assets/minecraft/sounds/block/chest/open.ogg';
import chestClose1 from '../../assets/minecraft/sounds/block/chest/close1.ogg';
import chestClose2 from '../../assets/minecraft/sounds/block/chest/close2.ogg';
import chestClose3 from '../../assets/minecraft/sounds/block/chest/close3.ogg';
import fireball from '../../assets/minecraft/sounds/mob/ghast/fireball4.ogg';
import orb from '../../assets/minecraft/sounds/random/orb.ogg';
import click from '../../assets/minecraft/sounds/random/click_stereo.ogg';
import pop from '../../assets/minecraft/sounds/random/pop.ogg';

const rand = Math.random;

// Each cue: its sound files (one is picked at random, as in the game), the vanilla volume and pitch
// ranges, a mix level, and a stereo pan matching where its source sits in the frame.
const EVENTS = {
  crackle: { files: [crackle1, crackle2, crackle3, crackle4, crackle5, crackle6], volume: () => 0.5 + rand(), pitch: () => 0.6 + rand() * 0.7, mix: 0.32, pan: 0.2 }, // block.campfire.crackle
  stoke: { files: [fireball], volume: () => 1, pitch: () => 1 + (rand() - rand()) * 0.2, mix: 0.55, pan: 0.2 }, // item.firecharge.use
  chestOpen: { files: [chestOpen], volume: () => 0.5, pitch: () => 0.9 + rand() * 0.1, mix: 1, pan: 0.45 }, // block.chest.open
  chestClose: { files: [chestClose1, chestClose2, chestClose3], volume: () => 0.5, pitch: () => 0.9 + rand() * 0.1, mix: 1, pan: 0.45 }, // block.chest.close
  wave: { files: [orb], volume: () => 0.5, pitch: () => 0.8 + rand() * 0.4, mix: 0.9, pan: 0 }, // entity.experience_orb.pickup
  click: { files: [click], volume: () => 0.25, pitch: () => 1, mix: 1, pan: 0 }, // ui.button.click
  chat: { files: [pop], volume: () => 0.3, pitch: () => 1.5 + rand() * 0.4, mix: 0.9, pan: -0.45 }, // entity.item.pickup, from the chat corner
};
const CUES = { wave: ['wave'], fire: ['stoke', 'crackle', 'crackle', 'crackle'], chestOpen: ['chestOpen'], chestClose: ['chestClose'], chat: ['chat'] };

const toArrayBuffer = (dataUrl) => {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export function createCampAudio(button) {
  let ctx = null, master = null, buffers = null, enabled = false, active = true, closed = false, nextCrackle = 0;
  try {
    enabled = localStorage.getItem('vaskel-camp-sound') === 'on';
  } catch {}

  const paint = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('span').textContent = enabled ? 'on' : 'off';
    button.setAttribute('aria-label', enabled ? 'Mute camp sounds' : 'Enable camp sounds');
  };
  paint();

  function init() {
    if (ctx || closed) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      enabled = false;
      paint();
      return;
    }
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.6 : 0;
    master.connect(ctx.destination);
    // Decode every clip once; cues before decoding finishes are simply skipped.
    Promise.all(Object.entries(EVENTS).map(async ([name, event]) => [name, await Promise.all(event.files.map((url) => ctx.decodeAudioData(toArrayBuffer(url))))]))
      .then((decoded) => {
        buffers = Object.fromEntries(decoded);
      })
      .catch(() => {});
  }

  function play(name, delay = 0) {
    if (!ctx || !buffers || !enabled || !active) return;
    const event = EVENTS[name], list = buffers[name], at = ctx.currentTime + delay;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = list[Math.floor(rand() * list.length)];
    source.playbackRate.value = event.pitch();
    gain.gain.value = event.volume() * event.mix;
    pan.pan.value = event.pan;
    source.connect(gain).connect(pan).connect(master);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    source.start(at);
  }

  function unlock() {
    if (closed || !enabled) return;
    init();
    if (active && ctx?.state === 'suspended') ctx.resume().catch(() => {});
  }

  return {
    unlock,
    toggle() {
      enabled = !enabled;
      unlock();
      if (master) master.gain.setTargetAtTime(enabled ? 0.6 : 0, ctx.currentTime, 0.08);
      try {
        localStorage.setItem('vaskel-camp-sound', enabled ? 'on' : 'off');
      } catch {}
      paint();
      play('click');
    },
    setActive(value) {
      active = value;
      if (!ctx) return;
      if (!value) ctx.suspend().catch(() => {});
      else if (enabled) ctx.resume().catch(() => {});
    },
    // Campfire crackles arrive at the game's rate (about two a second), faster while the fire is stoked.
    tick(t, strength) {
      if (!buffers || !enabled || !active) return;
      if (t >= nextCrackle) {
        play('crackle');
        nextCrackle = t + Math.max(0.08, (-Math.log(1 - rand()) * 0.55) / strength);
      }
    },
    cue(kind) {
      unlock();
      (CUES[kind] || []).forEach((name, i) => play(name, i * 0.07));
    },
    dispose() {
      closed = true;
      if (ctx) ctx.close().catch(() => {});
    },
  };
}

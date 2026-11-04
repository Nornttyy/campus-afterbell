import test from 'node:test';
import assert from 'node:assert/strict';
import { ClassroomRound, CLASSROOM_ACTIONS } from '../dist/classroom-rules.js';

const FRAME = 1 / 60;
const driveUntil = (round, predicate, control = () => {}, maxSeconds = 120) => {
  for (let frame = 0; frame < maxSeconds * 60; frame++) {
    const state = round.snapshot();
    if (predicate(state)) return state;
    control(state, round);
    round.step(FRAME);
  }
  assert.fail('Simulation did not reach the expected state in time.');
};

test('ready state is inert, public snapshots cannot mutate the round', () => {
  const round = new ClassroomRound({ seed: 1 });
  assert.equal(round.hold(true), false);
  assert.equal(round.requestHelp(), false);
  const before = round.snapshot();
  round.step(20);
  assert.deepEqual(round.snapshot(), before);
  const snapshot = round.snapshot();
  snapshot.teacher.phase = 'watching';
  snapshot.students[0].name = 'changed';
  snapshot.completed.phone = 100;
  assert.deepEqual(round.snapshot(), before);
});

test('same seed and inputs reproduce events and states across dt partitions', () => {
  const run = chunk => {
    const round = new ClassroomRound({ seed: '同一个教室' });
    round.start();
    const events = [];
    for (let second = 0; second < 35; second++) {
      if (second % 3 === 0) round.selectAction(['snack', 'note', 'phone'][second % 9 / 3]);
      if (second === 9 || second === 28) round.requestHelp();
      round.hold(second % 4 !== 3);
      for (let part = 0; part < Math.round(1 / chunk); part++) round.step(chunk);
      events.push(...round.drainEvents());
    }
    return { state: round.snapshot(), events };
  };
  assert.deepEqual(run(1), run(FRAME));
  assert.deepEqual(run(.25), run(FRAME));
  const round = new ClassroomRound({ seed: 55 });
  const initial = round.snapshot();
  round.start(); round.hold(true); round.step(20); round.reset();
  assert.deepEqual(round.snapshot(), initial);
  assert.deepEqual(round.drainEvents(), []);
  assert.notEqual(new ClassroomRound({ seed: 56 }).snapshot().teacher.phaseDuration, initial.teacher.phaseDuration);
});

test('each action has its own duration and reward, completion resets its progress', () => {
  for (const [action, rules] of Object.entries(CLASSROOM_ACTIONS)) {
    const round = new ClassroomRound({ seed: 73 });
    round.start(); round.selectAction(action); round.hold(true);
    round.step(rules.duration - FRAME);
    assert.equal(round.snapshot().completed[action], 0);
    round.step(FRAME);
    const state = round.snapshot();
    assert.equal(state.completed[action], 1);
    assert.equal(state.score, rules.points);
    assert.equal(state.actionProgress, 0);
    assert.equal(round.drainEvents().filter(event => event.type === 'complete' && event.actor === 'player').length, 1);
  }
});

test('releasing hides immediately and retains most unfinished action progress', () => {
  const round = new ClassroomRound();
  round.start(); round.selectAction('phone'); round.hold(true); round.step(2);
  const progress = round.snapshot().actionProgress;
  round.hold(false); round.step(.7);
  assert.equal(round.snapshot().actionProgress, progress);
  round.step(2);
  assert.ok(round.snapshot().actionProgress > progress * .85);
  assert.equal(round.snapshot().strikes, 0);
});

test('pause freezes all simulated state and resume requires a fresh held input', () => {
  const round = new ClassroomRound();
  round.start(); round.hold(true); round.step(1);
  round.pause(true);
  const frozen = round.snapshot();
  round.step(50); round.hold(true); round.requestHelp(); round.selectAction('phone');
  assert.deepEqual(round.snapshot(), frozen);
  round.pause(false);
  assert.equal(round.snapshot().holding, false);
  round.step(.5);
  assert.equal(round.snapshot().actionProgress, frozen.actionProgress);
  round.hold(true); round.step(.5);
  assert.ok(round.snapshot().actionProgress > frozen.actionProgress);
});

test('rapid input toggles cannot erase suspicion without spending time hidden', () => {
  const round = new ClassroomRound();
  round.start(); round.selectAction('phone');
  driveUntil(round, state => state.teacher.looking);
  round.hold(true); round.step(.5);
  const suspicion = round.snapshot().suspicion;
  assert.ok(suspicion > 20);
  for (let i = 0; i < 100; i++) { round.hold(false); round.hold(true); }
  assert.equal(round.snapshot().suspicion, suspicion);
  round.hold(false); round.step(.2);
  assert.ok(round.snapshot().suspicion < suspicion);
});

test('every normal teacher watch/patrol is telegraphed and turning cannot catch', () => {
  const round = new ClassroomRound({ seed: 27 });
  round.start();
  let previous = round.snapshot().teacher.phase, turnStarted = 0, watched = 0;
  for (let frame = 0; frame < 60 * 110; frame++) {
    const state = round.snapshot();
    round.hold(state.teacher.phase === 'turning');
    round.step(FRAME);
    const next = round.snapshot();
    if (next.teacher.phase === 'turning' && previous !== 'turning') turnStarted = next.elapsed;
    if (['watching', 'patrol'].includes(next.teacher.phase) && !['watching', 'patrol'].includes(previous)) {
      assert.equal(previous, 'turning');
      assert.ok(next.elapsed - turnStarted >= .8 - FRAME - 1e-6);
      watched++;
    }
    if (next.teacher.phase === 'turning') {
      assert.equal(next.teacher.warning, true);
      assert.equal(next.teacher.looking, false);
      assert.equal(next.strikes, 0);
    }
    previous = next.teacher.phase;
  }
  assert.ok(watched >= 7);
});

test('safe play plus teammate distraction can win with zero strikes', () => {
  for (const seed of [1, 27, 73, 2026]) {
    const round = new ClassroomRound({ seed });
    round.start(); round.selectAction('phone');
    const state = driveUntil(round, state => state.status !== 'playing', (state, engine) => {
      if (state.teacher.looking && state.helpCooldown === 0) engine.requestHelp();
      const now = engine.snapshot();
      engine.hold(!now.teacher.looking && !now.teacher.warning);
    });
    assert.equal(state.status, 'won', `seed ${seed}`);
    assert.equal(state.strikes, 0);
    assert.ok(state.score >= state.target);
    assert.ok(state.elapsed < 120);
    assert.equal(state.holding, false);
  }
});

test('reckless exposure loses in three catches and never completes on the catch tick', () => {
  const round = new ClassroomRound({ seed: 27 });
  round.start(); round.selectAction('phone');
  let previousStrikes = 0, catches = 0;
  for (let frame = 0; frame < 60 * 120 && round.snapshot().status === 'playing'; frame++) {
    round.hold(true); round.step(FRAME);
    const state = round.snapshot(), events = round.drainEvents();
    if (state.strikes > previousStrikes) {
      catches++;
      assert.equal(state.holding, false);
      assert.equal(state.actionProgress, 0);
      assert.equal(events.filter(event => event.type === 'complete' && event.actor === 'player').length, 0);
      if (state.status === 'playing') assert.equal(round.hold(true), false);
    }
    previousStrikes = state.strikes;
  }
  assert.equal(catches, 3);
  assert.equal(round.snapshot().status, 'lost');
  assert.equal(round.snapshot().strikes, 3);
});

test('help distracts for three seconds, cools down and involves different teammates', () => {
  const round = new ClassroomRound({ duration: 120 });
  round.start();
  assert.equal(round.requestHelp(), true);
  assert.equal(round.requestHelp(), false);
  assert.equal(round.snapshot().teacher.phase, 'distracted');
  assert.equal(round.snapshot().teacher.looking, false);
  assert.equal(round.snapshot().students[0].mood, 'cough');
  round.step(3 - FRAME);
  assert.equal(round.snapshot().teacher.phase, 'distracted');
  round.step(FRAME);
  assert.equal(round.snapshot().teacher.phase, 'board');
  round.step(15);
  assert.equal(round.snapshot().helpCooldown, 0);
  assert.equal(round.requestHelp(), true);
  const helps = round.drainEvents().filter(event => event.type === 'help');
  assert.equal(helps.length, 2);
  assert.notEqual(helps[0].studentId, helps[1].studentId);
});

test('idle player can never win from AI alone, even with very small targets', () => {
  for (const target of [1, 6, 18, 160]) {
    const round = new ClassroomRound({ target, seed: 1 });
    round.start(); round.step(1000000);
    const state = round.snapshot();
    assert.equal(state.status, 'lost');
    assert.ok(state.score <= Math.min(24, Math.floor(target * .15)));
    assert.ok(state.score < target);
    assert.equal(state.elapsed, 120);
    assert.equal(state.timeLeft, 0);
    assert.deepEqual(state.completed, { snack: 0, note: 0, phone: 0 });
    assert.equal(state.students.filter(student => student.progress === 1).length, 4);
  }
});

test('completion on the final tick wins and a terminal round emits finish only once', () => {
  const round = new ClassroomRound({ duration: 3, target: 18 });
  round.start(); round.hold(true); round.step(3);
  assert.equal(round.snapshot().status, 'won');
  assert.equal(round.snapshot().timeLeft, 0);
  const state = round.snapshot();
  assert.equal(round.drainEvents().filter(event => event.type === 'finish').length, 1);
  round.step(100); round.start(); round.hold(true); round.requestHelp(); round.pause(true);
  assert.deepEqual(round.snapshot(), state);
  assert.deepEqual(round.drainEvents(), []);
  const short = new ClassroomRound({ duration: .025 });
  short.start(); short.step(1);
  assert.equal(short.snapshot().timeLeft, 0);
  assert.equal(short.snapshot().elapsed, .025);
});

test('invalid input is ignored without corrupting state; speech has a four-second minimum gap', () => {
  const round = new ClassroomRound();
  round.start();
  const before = round.snapshot();
  for (const dt of [NaN, Infinity, -1, 0, '1', null, undefined]) round.step(dt);
  for (const action of ['', 'run', '__proto__', null, undefined]) assert.equal(round.selectAction(action), false);
  assert.deepEqual(round.snapshot(), before);
  round.hold(true);
  const holding = round.snapshot();
  for (const value of [null, undefined, 0, 1, 'false']) round.hold(value);
  assert.deepEqual(round.snapshot(), holding);
  round.hold(false);
  round.drainEvents();
  let lastSpeech = -Infinity;
  for (let frame = 0; frame < 60 * 100 && round.snapshot().status === 'playing'; frame++) {
    const state = round.snapshot();
    round.hold(!state.teacher.looking && !state.teacher.warning);
    if (state.helpCooldown === 0) round.requestHelp();
    round.step(FRAME);
    for (const event of round.drainEvents()) if (event.type === 'speech') {
      assert.ok(round.snapshot().elapsed - lastSpeech >= 4 - FRAME - 1e-6);
      lastSpeech = round.snapshot().elapsed;
    }
  }
});

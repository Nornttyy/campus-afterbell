/** Deterministic classroom rules. No DOM, timers, audio or rendering dependencies. */
export const CLASSROOM_ACTIONS = Object.freeze({
  snack: Object.freeze({ duration: 3, points: 18, risk: 1, noise: 6, label: '偷吃零食' }),
  note: Object.freeze({ duration: 4, points: 25, risk: .82, noise: 3.5, label: '传纸条' }),
  phone: Object.freeze({ duration: 5, points: 34, risk: 1.28, noise: 8, label: '玩手机' }),
});

const TICK = 1 / 60;
const EPS = 1e-9;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validPositive = (value, fallback, max) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(value, max) : fallback;
const clean = value => Math.round(value * 1e6) / 1e6;
const seedValue = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
  const text = typeof value === 'string' ? value : 'campus-afterbell';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
};

export class ClassroomRound {
  constructor({ seed = 73, duration = 120, target = 160 } = {}) {
    this.duration = validPositive(duration, 120, 600);
    this.target = validPositive(target, 160, 100000);
    this.seed = seedValue(seed);
    this.reset();
  }

  reset(seed) {
    if (seed !== undefined) this.seed = seedValue(seed);
    this._randomState = this.seed;
    this.status = 'ready';
    this.paused = false;
    this.elapsed = 0;
    this.score = 0;
    this.strikes = 0;
    this.suspicion = 0;
    this.selected = 'snack';
    this.holding = false;
    this.completed = { snack: 0, note: 0, phone: 0 };
    this.helpCooldown = 0;
    this._progress = { snack: 0, note: 0, phone: 0 };
    this._events = [];
    this._accumulator = 0;
    this._noise = 0;
    this._releasedFor = 0;
    this._inputLock = 0;
    this._lastSpeech = -Infinity;
    this._helpCount = 0;
    this._aiScore = 0;
    this._aiBudget = Math.min(24, Math.floor(this.target * .15));
    this._nextTeacherPhase = 'watching';
    this.teacher = this._makePhase('board', this._range(5.2, 7.6));
    const tasks = ['note', 'snack', 'phone', 'note'];
    this.students = ['小满', '阿杰', '小雨', '乐乐'].map((name, id) => ({
      id, name, mood: 'writing', progress: 0, caught: false,
      _task: tasks[id], _duration: this._range(11, 17) + id * 1.5,
      _contributed: false, _helpUntil: 0,
    }));
    return this.snapshot();
  }

  start() {
    if (this.status !== 'ready') return this.snapshot();
    this.status = 'playing';
    this.holding = false;
    this.paused = false;
    this._say('老师', '翻开课本，认真看。');
    return this.snapshot();
  }

  selectAction(action) {
    if (!Object.hasOwn(CLASSROOM_ACTIONS, action) || this.paused || !['ready', 'playing'].includes(this.status)) return false;
    if (action !== this.selected) {
      this.hold(false);
      this.selected = action;
    }
    return true;
  }

  hold(value) {
    if (typeof value !== 'boolean') return false;
    if (!value) {
      if (this.holding) {
        this._releasedFor = 0;
      }
      this.holding = false;
      return false;
    }
    if (this.status !== 'playing' || this.paused || this._inputLock > EPS) return false;
    this.holding = true;
    this._releasedFor = 0;
    return true;
  }

  requestHelp() {
    if (this.status !== 'playing' || this.paused || this.helpCooldown > EPS) return false;
    const helper = this.students[this._helpCount++ % this.students.length];
    helper.mood = 'cough';
    helper._helpUntil = this.elapsed + 3;
    this.helpCooldown = 18;
    this.teacher = this._makePhase('distracted', 3);
    this._noise = Math.max(0, this._noise - 15);
    this._events.push({ type: 'help', speaker: helper.name, studentId: helper.id, duration: 3, text: '咳咳！老师看这边！' });
    this._say(helper.name, '我来吸引老师。');
    return true;
  }

  pause(value = true) {
    if (typeof value !== 'boolean' || this.status !== 'playing') return this.snapshot();
    if (value !== this.paused) {
      this.hold(false);
      this._accumulator = 0;
    }
    this.paused = value;
    return this.snapshot();
  }

  /** dt is seconds. Large deltas are bounded by the remaining round duration. */
  step(dt) {
    if (this.status !== 'playing' || this.paused || typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return this.snapshot();
    this._accumulator += Math.min(dt, this.duration - this.elapsed);
    while (this.status === 'playing') {
      const remaining = this.duration - this.elapsed;
      const tick = Math.min(TICK, remaining);
      if (this._accumulator + EPS < tick) break;
      this._accumulator = Math.max(0, this._accumulator - tick);
      this._advance(tick);
    }
    if (this.status !== 'playing') this._accumulator = 0;
    return this.snapshot();
  }

  snapshot() {
    const t = this.teacher;
    return {
      status: this.status, paused: this.paused, seed: this.seed,
      elapsed: clean(this.elapsed), timeLeft: clean(Math.max(0, this.duration - this.elapsed)),
      score: this.score, target: this.target, strikes: this.strikes,
      suspicion: clean(this.suspicion), selected: this.selected, holding: this.holding,
      actionProgress: clean(this._progress[this.selected]), completed: { ...this.completed },
      teacher: { phase: t.phase, phaseTime: clean(t.phaseTime), phaseDuration: clean(t.phaseDuration), looking: t.looking, warning: t.warning, attention: clean(t.attention), walkProgress: clean(t.walkProgress) },
      students: this.students.map(({ id, name, mood, progress, caught }) => ({ id, name, mood, progress: clean(progress), caught })),
      helpCooldown: clean(this.helpCooldown),
    };
  }

  drainEvents() {
    const events = this._events;
    this._events = [];
    return events;
  }

  _random() {
    let t = this._randomState = (this._randomState + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  _range(min, max) { return min + (max - min) * this._random(); }

  _makePhase(phase, duration) {
    return { phase, phaseTime: 0, phaseDuration: duration, looking: phase === 'watching', warning: phase === 'turning', attention: phase === 'watching' ? .95 : .05, walkProgress: 0 };
  }

  _say(speaker, text) {
    if (this.elapsed - this._lastSpeech + EPS < 4) return;
    this._lastSpeech = this.elapsed;
    this._events.push({ type: 'speech', speaker, text });
  }

  _nextPhase() {
    const current = this.teacher.phase;
    if (current === 'board') {
      this._nextTeacherPhase = this._random() < .24 + this._noise * .003 ? 'patrol' : 'watching';
      this.teacher = this._makePhase('turning', .8);
      this._events.push({ type: 'warning', speaker: '老师', text: '老师要回头了！', duration: .8 });
    } else if (current === 'turning') {
      const patrol = this._nextTeacherPhase === 'patrol';
      this.teacher = this._makePhase(patrol ? 'patrol' : 'watching', (patrol ? this._range(4.4, 6) : this._range(2.8, 4.2)) + this._noise * .018);
      this._say('老师', patrol ? '我下来走走。' : '谁在下面做小动作？');
    } else {
      this.teacher = this._makePhase('board', clamp(this._range(5.1, 7.5) - this._noise * .025, 3.8, 7.5));
      this._say('老师', '看黑板，接着讲。');
    }
  }

  _advanceTeacher(dt) {
    this.teacher.phaseTime += dt;
    while (this.teacher.phaseTime + EPS >= this.teacher.phaseDuration) {
      const spill = Math.max(0, this.teacher.phaseTime - this.teacher.phaseDuration);
      this._nextPhase();
      this.teacher.phaseTime = spill;
    }
    const t = this.teacher, progress = clamp(t.phaseTime / t.phaseDuration, 0, 1);
    t.warning = t.phase === 'turning';
    t.walkProgress = t.phase === 'patrol' ? progress : 0;
    t.looking = t.phase === 'watching' || (t.phase === 'patrol' && progress >= .10 && progress <= .88);
    t.attention = t.phase === 'turning' ? .15 + progress * .7 : t.looking ? (t.phase === 'patrol' ? .8 + Math.sin(progress * Math.PI) * .2 : .95) : .05;
  }

  _advance(dt) {
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    this.helpCooldown = Math.max(0, this.helpCooldown - dt);
    this._inputLock = Math.max(0, this._inputLock - dt);
    this._noise = Math.max(0, this._noise - dt * 2.4);
    this._advanceTeacher(dt);
    const action = CLASSROOM_ACTIONS[this.selected];
    if (this.holding) {
      this._noise = clamp(this._noise + action.noise * dt, 0, 100);
      this.suspicion = clamp(this.suspicion + (this.teacher.looking ? 65 * action.risk * this.teacher.attention : -10) * dt, 0, 100);
      if (this.suspicion + EPS >= 100) this._catch();
      else {
        this._progress[this.selected] = Math.min(1, this._progress[this.selected] + dt / action.duration);
        if (this._progress[this.selected] + EPS >= 1) this._completePlayer();
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - dt * 34);
      this._releasedFor += dt;
      if (this._releasedFor > 1.2) for (const key of Object.keys(this._progress)) this._progress[key] = Math.max(0, this._progress[key] - dt * .012);
    }
    if (this.status !== 'playing') return;
    this._advanceStudents(dt);
    if (this.status === 'playing' && this.elapsed + EPS >= this.duration) this._finish('lost', 'timeout');
  }

  _completePlayer() {
    const action = this.selected, points = CLASSROOM_ACTIONS[action].points;
    this.completed[action]++;
    this._progress[action] = 0;
    this.score += points;
    this._noise = Math.min(100, this._noise + 6);
    this._events.push({ type: 'complete', actor: 'player', action, points, score: this.score, text: `${CLASSROOM_ACTIONS[action].label}成功！` });
    this._say('你', { snack: '这口真香。', note: '纸条传过去了。', phone: '消息发出去了。' }[action]);
    if (this.score >= this.target) this._finish('won', 'target');
  }

  _catch() {
    this.strikes++;
    this.holding = false;
    this._progress[this.selected] = 0;
    this.suspicion = 0;
    this._inputLock = .7;
    this._releasedFor = 0;
    this._events.push({ type: 'caught', speaker: '老师', strikes: this.strikes, action: this.selected, text: ['后排那位，认真听！', '又是你？我记住了。', '下课留下来！'][this.strikes - 1] });
    if (this.strikes >= 3) this._finish('lost', 'strikes');
  }

  _advanceStudents(dt) {
    const safe = !this.teacher.looking && !this.teacher.warning;
    for (const student of this.students) {
      if (student._helpUntil > this.elapsed) { student.mood = 'cough'; continue; }
      if (student._contributed || !safe) { student.mood = this.teacher.warning ? 'thinking' : 'writing'; continue; }
      student.mood = student._task;
      student.progress = Math.min(1, student.progress + dt / student._duration);
      if (student.progress + EPS < 1) continue;
      student.progress = 1;
      student._contributed = true;
      student.mood = 'writing';
      const points = Math.min(6, this._aiBudget - this._aiScore);
      if (points <= 0) continue;
      this._aiScore += points;
      this.score += points;
      this._events.push({ type: 'complete', actor: 'ai', studentId: student.id, speaker: student.name, action: student._task, points, score: this.score, text: '同学配合成功！' });
      this._say(student.name, '我这边搞定啦。');
      if (this.score >= this.target) { this._finish('won', 'target'); return; }
    }
  }

  _finish(status, reason) {
    if (this.status !== 'playing') return;
    this.status = status;
    this.holding = false;
    this.paused = false;
    this._events.push({ type: 'finish', status, reason, score: this.score, text: status === 'won' ? '下课铃响，捣蛋成功！' : reason === 'strikes' ? '被老师逮住三次了。' : '下课了，还差一点。' });
  }
}

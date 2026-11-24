import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  ListChecks,
  LockKeyhole,
  Map,
  Sprout,
} from "lucide-react";
import { byId, course } from "../content";

const numerals = ["一", "二", "三", "四"];
const first = course.lessons[0];
function LessonList({
  ids,
  passedIds,
}: {
  ids: string[];
  passedIds: readonly string[];
}) {
  return (
    <ol className="lesson-list">
      {ids.map((id) => {
        const l = byId(course.lessons, id);
        const passed = passedIds.includes(id);
        const active = l.stage === "available";
        const num = String(course.lessons.indexOf(l) + 1).padStart(2, "0");
        const content = (
          <>
            <span className="step-num">
              {active && passed ? <Check size={18} /> : num}
            </span>
            <span className="row-title">
              {l.title}
              <small>
                {active
                  ? passed
                    ? "本次已通过 · 可重练"
                    : "可学习 · 8 道练习"
                  : "规划中"}
              </small>
            </span>
            {active ? <ChevronRight size={18} /> : <LockKeyhole size={15} />}
          </>
        );
        return (
          <li key={id}>
            {active ? (
              <Link className="lesson-row available" to={"/learn/" + id}>
                {content}
              </Link>
            ) : (
              <div className="lesson-row">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
function WordNote() {
  const [selected, setSelected] = useState(0);
  const skill = course.skills[selected],
    passage = byId(course.passages, first.exampleIds[selected]);
  const [before, after] = passage.text.split(skill.word);
  return (
    <section>
      <h2 className="section-title">
        <Bookmark />
        字词手记
      </h2>
      <div className="note">
        <div className="note-top">
          <span>实词 · 古今词义</span>
          <span className="folio">
            {String(selected + 1).padStart(2, "0")} / 03
          </span>
        </div>
        <div className="word-line">
          <strong>{skill.word}</strong>
          <span>{skill.meaning}</span>
        </div>
        <blockquote>
          {before}
          <em>{skill.word}</em>
          {after}
        </blockquote>
        <small>教学例句</small>
        <div className="word-buttons" aria-label="选择字词">
          {course.skills.map((s, i) => (
            <button
              key={s.id}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
            >
              {s.word}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Home({
  practiced,
  passedIds,
}: {
  practiced: boolean;
  passedIds: readonly string[];
}) {
  return (
    <main className="shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="dash" /> 学习手册
          </div>
          <h1>今日学习</h1>
        </div>
        <span className="progress-label">
          <Flag size={15} /> 已通过 <b>{passedIds.length}</b> / 12 课
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="tagline">
            <span className="tag">当前课程</span>
            <span>第一单元 · 古今词义</span>
          </div>
          <h2>走、去、闻</h2>
          <p>{first.intro}</p>
          <div className="meta">
            <span>
              <Clock3 />
              5–8 分钟
            </span>
            <i />
            <span>
              <ListChecks />8 道练习
            </span>
          </div>
          <Link className="primary" to={"/learn/" + first.id}>
            {practiced ? "再学一次" : "开始学习"}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="青绿色版画山水，旅人走过山间小桥"
        />
      </section>
      <div className="home-grid">
        <section>
          <div className="section-head">
            <h2 className="section-title">
              <Map />
              课程路径
            </h2>
            <Link className="text-link" to="/path">
              查看全部 <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="unit-preview">
            <div className="unit-head">
              <div className="unit-kicker">第一单元</div>
              <h3>古今词义</h3>
            </div>
            <LessonList ids={course.units[0].lessonIds} passedIds={passedIds} />
          </div>
        </section>
        <WordNote />
      </div>
      <footer>
        <BookOpen size={14} />
        文言拾阶<span>教学内容 · 草稿预览</span>
      </footer>
    </main>
  );
}
export function Path({ passedIds }: { passedIds: readonly string[] }) {
  return (
    <main className="shell">
      <div className="eyebrow">
        <Sprout size={16} /> L1 · 读懂单句
      </div>
      <h1>课程路径</h1>
      <p className="lead">
        从辨认一个词，到读懂一段古文。共 4 个单元，12 节课。
      </p>
      <div className="path-grid">
        {course.units.map((u, i) => (
          <section key={u.id} className="unit-preview">
            <div className="unit-head">
              <div className="unit-kicker">第{numerals[i]}单元</div>
              <h2>{u.title}</h2>
              <p>{u.description}</p>
            </div>
            <LessonList ids={u.lessonIds} passedIds={passedIds} />
            <div className="assessment">
              <LockKeyhole size={14} />
              单元检查 · 6 题 · 规划中
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

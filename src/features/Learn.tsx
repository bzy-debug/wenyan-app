import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  CircleHelp,
  RotateCcw,
} from "lucide-react";
import { byId, course, optionText } from "../content";
import type { Lesson } from "../content/schema";
import { grade, recordFirst, summarize } from "../domain/session";
import type { Attempts } from "../domain/session";
import type { Completed } from "../app/App";
import { Choice, Order, SelectSpan } from "../components/questions/Inputs";
const inputs = { choice: Choice, order: Order, span: SelectSpan };
const names = { choice: "单项选择", order: "事件排序", span: "原文选段" };
export function Learn({ onFinish }: { onFinish: (result: Completed) => void }) {
  const { id } = useParams();
  const lesson = course.lessons.find(
    (l) => l.id === id && l.stage === "available",
  );
  return lesson ? (
    <Session key={lesson.id} lesson={lesson} onFinish={onFinish} />
  ) : (
    <Navigate to="/path" replace />
  );
}
function Session({
  lesson,
  onFinish,
}: {
  lesson: Lesson;
  onFinish: (result: Completed) => void;
}) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(-1);
  const [selected, change] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Attempts>({});
  const [hinted, setHinted] = useState(false);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  function next() {
    if (index === lesson.questionIds.length - 1) {
      onFinish({ lessonId: lesson.id, attempts });
      navigate("/result");
      return;
    }
    setIndex(index + 1);
    change([]);
    setHinted(false);
    setFeedback(null);
    window.scrollTo(0, 0);
  }
  const q =
    index < 0 ? null : byId(course.questions, lesson.questionIds[index]);
  if (!q)
    return (
      <main className="reading">
        <Link className="back" to="/path">
          <ArrowLeft />
          课程路径
        </Link>
        <div className="eyebrow">第一单元 · 课前讲解</div>
        <h1>{lesson.title}</h1>
        <p className="lead">{lesson.intro}</p>
        <div className="teaching">
          {lesson.mainSkills.map((id, i) => {
            const s = byId(course.skills, id),
              p = byId(course.passages, lesson.exampleIds[i]);
            return (
              <article key={id}>
                <div className="character">{s.word}</div>
                <div>
                  <h2>{s.meaning}</h2>
                  <p>{s.detail}</p>
                  <blockquote>{p.text}</blockquote>
                  <small>教学例句 · {p.gloss}</small>
                </div>
              </article>
            );
          })}
        </div>
        <p className="fine">
          草稿练习 · 8 题中至少 6 题无提示首答正确，并覆盖三个义项，即可通过。
        </p>
        <button className="primary" onClick={next}>
          开始练习
          <ArrowRight />
        </button>
      </main>
    );
  const passage = byId(course.passages, q.passageId),
    Input = inputs[q.mode];
  const ready = selected.length === (q.mode === "order" ? q.options.length : 1);
  function submit() {
    if (!q || !ready || feedback !== null) return;
    const correct = grade(q, selected);
    setAttempts((prev) => recordFirst(prev, q.id, { correct, hinted }));
    setFeedback(correct);
  }
  return (
    <main className="reading">
      <Link className="back" to="/">
        <ArrowLeft />
        退出本轮
      </Link>
      <div className="question-top">
        <span>{lesson.title}</span>
        <b>
          {index + 1} / {lesson.questionIds.length}
        </b>
      </div>
      <progress
        value={index + 1}
        max={lesson.questionIds.length}
        aria-label="当前题号"
      />
      <div className="eyebrow">{names[q.mode]} · 教学例句</div>
      <h1 className="prompt">{q.prompt}</h1>
      {q.mode !== "span" && (
        <blockquote className="passage">{passage.text}</blockquote>
      )}
      <Input
        question={q}
        selected={selected}
        change={change}
        locked={feedback !== null}
      />
      {feedback === null ? (
        <>
          <button
            className="hint"
            disabled={hinted}
            onClick={() => setHinted(true)}
          >
            <CircleHelp />
            查看关键提示（影响首答）
          </button>
          {hinted && (
            <p className="hint-text" role="status">
              {q.hint}
            </p>
          )}
          <div>
            <button className="primary" disabled={!ready} onClick={submit}>
              提交答案
              <ArrowRight />
            </button>
          </div>
        </>
      ) : (
        <section
          className={"feedback " + (feedback ? "right" : "wrong")}
          aria-live="polite"
        >
          <h2>{feedback ? "回答正确" : "再读一遍原文"}</h2>
          <b>答案 · {q.answer.map((id) => optionText(q, id)).join(" → ")}</b>
          {!feedback && q.mode !== "order" && (
            <p>{byId(q.options, selected[0]).reason}</p>
          )}
          {!feedback && q.mode === "order" && (
            <p>
              你选的顺序是“{selected.map((id) => optionText(q, id)).join(" → ")}
              ”。留意第一个与原文不符的动作。
            </p>
          )}
          <p>{q.analysis}</p>
          <small>句意 · {passage.gloss}</small>
          <div className="actions">
            <button className="primary" onClick={next}>
              {index === lesson.questionIds.length - 1 ? "查看结算" : "下一题"}
              <ArrowRight />
            </button>
            {!feedback && (
              <button
                className="secondary"
                onClick={() => {
                  change([]);
                  setFeedback(null);
                }}
              >
                <RotateCcw />
                重试本题
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
export function Result({ result }: { result: Completed }) {
  const lesson = byId(course.lessons, result.lessonId),
    stats = summarize(lesson, course.questions, result.attempts);
  return (
    <main className="reading">
      <div className="eyebrow">
        <CircleCheck size={18} />
        关卡结算
      </div>
      <h1>{stats.passed ? "本课已通过" : "本轮练习完成"}</h1>
      <p className="lead">{lesson.title}</p>
      <section className="score">
        <span>无提示首答正确</span>
        <strong>
          {stats.earned}
          <small> / 8</small>
        </strong>
      </section>
      <h2>义项掌握情况</h2>
      <div className="coverage">
        {stats.coverage.map((c) => {
          const s = byId(course.skills, c.id);
          return (
            <div key={c.id}>
              <span>
                {s.word} · {s.meaning}
              </span>
              <b>
                {c.earned} / {c.total} {c.earned > 0 && <Check size={15} />}
              </b>
            </div>
          );
        })}
      </div>
      <p>
        {stats.passed
          ? "已达到下一课的解锁条件。第二课仍在编写中。"
          : "通过条件为至少 6 题无提示首答正确，且每个义项至少 1 题达标。可重开一轮练习。"}
      </p>
      <small>重试不覆盖首答。本阶段刷新后清除成绩。</small>
      <div className="actions">
        <Link className="primary" to="/path">
          查看课程路径
          <ArrowRight />
        </Link>
        <Link className="secondary" to={"/learn/" + lesson.id}>
          <BookOpen size={16} />
          再学一次
        </Link>
      </div>
    </main>
  );
}

import { Fragment } from "react";
import { ArrowDown, Check, Undo2 } from "lucide-react";
import { byId, course, optionText } from "../../content";
import type { Question } from "../../content/schema";
type Props = {
  question: Question;
  selected: string[];
  change: (value: string[]) => void;
  locked: boolean;
};
export function Choice({ question, selected, change, locked }: Props) {
  return (
    <div className="choices">
      {question.options.map((o, i) => (
        <button
          key={o.id}
          disabled={locked}
          aria-pressed={selected[0] === o.id}
          onClick={() => change([o.id])}
        >
          <span className="letter">{String.fromCharCode(65 + i)}</span>
          {o.label}
          {selected[0] === o.id && <Check size={16} />}
        </button>
      ))}
    </div>
  );
}
export function SelectSpan({ question, selected, change, locked }: Props) {
  const passage = byId(course.passages, question.passageId);
  const fragments = question.options
    .map((o) => ({ id: o.id, span: byId(course.spans, o.spanId!) }))
    .sort((a, b) => a.span.start - b.span.start);
  return (
    <div className="span-input">
      {fragments.map(({ id, span }, i) => (
        <Fragment key={id}>
          {passage.text.slice(i ? fragments[i - 1].span.end : 0, span.start)}
          <button
            disabled={locked}
            aria-pressed={selected[0] === id}
            onClick={() => change([id])}
          >
            {span.text}
          </button>
        </Fragment>
      ))}
      {passage.text.slice(fragments.at(-1)!.span.end)}
    </div>
  );
}
export function Order({ question, selected, change, locked }: Props) {
  return (
    <div className="order-input">
      <div className="order-slots">
        {question.options.map((o, i) => (
          <div key={o.id}>
            <span>{i + 1}</span>
            {selected[i] ? optionText(question, selected[i]) : "待选择"}
            {i + 1 < question.options.length && <ArrowDown size={14} />}
          </div>
        ))}
      </div>
      <div className="order-pool">
        {question.options.map((o) => (
          <button
            key={o.id}
            disabled={locked || selected.includes(o.id)}
            onClick={() => change([...selected, o.id])}
          >
            {o.label}
          </button>
        ))}
        <button
          disabled={locked || !selected.length}
          onClick={() => change(selected.slice(0, -1))}
        >
          <Undo2 size={14} />
          撤回上一步
        </button>
      </div>
    </div>
  );
}

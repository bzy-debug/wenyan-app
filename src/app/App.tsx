import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { BookOpen, Compass, Layers, Route as PathIcon } from "lucide-react";
import { Home, Path } from "../features/Library";
import { Learn, Result } from "../features/Learn";
import { byId, course } from "../content";
import { summarize } from "../domain/session";
import type { Attempts } from "../domain/session";
export interface Completed {
  lessonId: string;
  attempts: Attempts;
}
export function App() {
  const [result, setResult] = useState<Completed | null>(null);
  const [passedIds, setPassedIds] = useState<readonly string[]>([]);
  function finish(round: Completed) {
    setResult(round);
    const lesson = byId(course.lessons, round.lessonId);
    if (summarize(lesson, course.questions, round.attempts).passed) {
      setPassedIds((ids) =>
        ids.includes(lesson.id) ? ids : [...ids, lesson.id],
      );
    }
  }
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <header className="top">
        <div className="top-inner">
          <Link to="/" className="brand">
            <span className="mark">
              <BookOpen size={23} />
            </span>
            文言拾阶
          </Link>
          <nav aria-label="主导航">
            <NavLink end to="/">
              <Compass />
              今日学习
            </NavLink>
            <NavLink to="/path">
              <PathIcon />
              课程路径
            </NavLink>
          </nav>
          <span className="level">
            <Layers size={16} /> L1 <i /> 入门
          </span>
        </div>
      </header>
      <Routes>
        <Route
          index
          element={<Home practiced={Boolean(result)} passedIds={passedIds} />}
        />
        <Route path="/path" element={<Path passedIds={passedIds} />} />
        <Route path="/learn/:id" element={<Learn onFinish={finish} />} />
        <Route
          path="/result"
          element={
            result ? <Result result={result} /> : <Navigate replace to="/" />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </>
  );
}

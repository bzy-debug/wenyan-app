import { join, relative, resolve } from "node:path";
import type { Plugin } from "vite";
import { compileCourse } from "./compile";
import { compileReadings } from "./compileReadings";
import { compilePilot } from "./compilePilot";
import { readSources } from "./node";

/** Markdown is compiled on the build machine. The browser receives only
 * the validated data module unless the author opens the preview editor. */
export function courseMarkdown(): Plugin {
  const groups = {
    course: compileCourse,
    pilot: compilePilot,
    readings: compileReadings,
  };
  let contentRoot = "";
  const prefix = "virtual:wenyan-";
  const questionModule = prefix + "course-questions";
  let splitCourse = false;
  let compiledCourse: ReturnType<typeof compileCourse> | undefined;

  const moduleFor = (id: string) =>
    Object.hasOwn(groups, id.slice(prefix.length)) && id.startsWith(prefix);
  return {
    name: "wenyan-markdown",
    configResolved(config) {
      contentRoot = resolve(config.root, "content/v1");
      splitCourse = config.command === "build";
    },
    buildStart() {
      compiledCourse = undefined;
    },
    resolveId(id) {
      if (moduleFor(id) || (splitCourse && id === questionModule))
        return "\0" + id;
    },
    load(id) {
      const virtualId = id.slice(1);
      const questionChunk = splitCourse && virtualId === questionModule;
      if (!id.startsWith("\0") || (!moduleFor(virtualId) && !questionChunk))
        return;
      const key = questionChunk
        ? "course"
        : (virtualId.slice(prefix.length) as keyof typeof groups);
      const dir = join(contentRoot, key);
      const sources = readSources(dir);
      for (const file of Object.keys(sources))
        this.addWatchFile(join(dir, file));
      // Each static import fits in Workbox's precache, including on the first offline lesson.
      if (splitCourse && key === "course") {
        compiledCourse ??= compileCourse(sources);
        const { questions, ...course } = compiledCourse;
        if (questionChunk)
          return "export default " + JSON.stringify(questions) + ";";
        return `import questions from ${JSON.stringify(questionModule)};
          export default { ...${JSON.stringify(course)}, questions };`;
      }
      return "export default " + JSON.stringify(groups[key](sources)) + ";";
    },
    configureServer(server) {
      server.watcher.add(contentRoot);
      // New files and deleted files have no importer in the module graph.
      const refresh = (file: string) => {
        const [group] = relative(contentRoot, file).split(/[/\\]/);
        if (!file.endsWith(".md") || !Object.hasOwn(groups, group)) return;
        const mod = server.moduleGraph.getModuleById("\0" + prefix + group);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher
        .on("add", refresh)
        .on("unlink", refresh)
        .on("change", refresh);
    },
  };
}

import * as cp from "node:child_process";
import { promisify } from "node:util";
import { stat, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export const cleanExit = (message) =>
  Object.assign(new Error(message), { errorLevel: 0 });

export const exec = promisify(cp.exec);

export const readJson = async (path) =>
  JSON.parse(await readFile(path, "utf8"));

export const writeJson = async (path, obj) =>
  await writeFile(path, JSON.stringify(obj, null, 2), "utf8");

export const exists = (path) =>
  stat(path).then(
    () => true,
    () => false
  );

export const findRoot = async (path) => {
  let cur = path;
  while (cur !== "/") {
    if (await exists(resolve(cur, "package.json"))) {
      return cur;
    }
    cur = dirname(cur);
  }
  throw new Error(`Path "${path}" is not part of any node project.`);
};

export const inLocalPrefix = async (fn) => {
  const origWd = process.cwd();
  const localPrefix =
    process.env.npm_config_local_prefix ?? (await findRoot(process.cwd()));
  process.chdir(localPrefix);
  let rv;
  try {
    rv = await fn();
  } finally {
    process.chdir(origWd);
  }
  return rv;
};

export const runJobs = async (jobs) => {
  const tasks = (
    await Promise.all(
      jobs.map(async (job) => ({ ...job, ok: !job.if || (await job.if()) }))
    )
  ).filter((job) => job.ok);
  const stash = async (path) => {
    if (!(await exists(path))) {
      return async () => await unlink(path);
    }
    if ((await stat(path)).isDirectory()) {
      throw new Error(
        `willChange():[${path} (a directory)] is not supported; return an array of file paths`
      );
    }
    const data = await readFile(path);
    return async () => await writeFile(path, data);
  };
  if (!tasks.length) {
    throw cleanExit("Nothing to do.");
  }
  const undo = [];
  let lastTask;
  try {
    for (const task of tasks) {
      console.log(`Task: ${task.name}`);
      const restore = await Promise.all(
        ((await task?.willChange?.()) || []).map((path) => stash(path))
      );
      lastTask = task;
      await task.do?.();
      undo.unshift({
        ...task,
        restore,
      });
    }
  } catch (e) {
    console.warn(`  Failed with "${e.message}"`);
    for (const task of undo) {
      console.warn(`    Rolling back: ${task.name}`);
      if (typeof task.undo === "function") {
        await task.undo();
      }
      for (const unstash of task.restore) {
        await unstash();
      }
    }
    throw e;
  }
};

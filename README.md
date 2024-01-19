# @fordi-org/scripting

Tiny lib for doing shell-scripty stuff

## cleanExit

Exit with an errorLevel of 0

```javascript
throw cleanExit("Everything is OK; we're just done");
```

## exec

Promisified child_process.exec

```javascript
const { stdout } = await exec("ls");
```

## readJson / writeJson

Convenience for JSON interaction

```javascript
const pkg = await readJson("package.json");
pkg.newProp = value;
await writeJson("package.json", pkg);
```

## exists

Convenience for verifying a file exists

```javascript
if (await exists("package.json")) {
  doStuffWithPackage();
}
```

## findRoot

Find the npm project root for a path.

```javascript
const packageFile = resolve(await findRoot(searchPath), "package.json");
```

## inLocalPrefix

For a project that's expected to be run via `npx`, change the working directory to the local prefix, and run an async function.

```javascript
await inLocalPrefix(async () => {
  console.log((await exec('ls')).stdout);
});
```

## runJobs

Run a list of Jobs, with supported rollback.  A Job is of the structure:

| Key        | Type                 | Req? | Description                                                                                |
|-----------:|----------------------|:----:|--------------------------------------------------------------------------------------------|
| name       | string               | √    | Task name                                                                                  |
| if         | async () => boolean  |      | Return true if the task should run; task always runs if undefined                          |
| willChange | async () => string[] |      | For rollback; files that should be stored before the task is run, and restored if it fails |
| do         | async () => void     | √    | Task to execute                                                                            |
| undo       | async () => void     |      | Executed for rollback                                                                      |

```javascript
await runJobs([
  {
    name: "Install myDependency",
    if: async () =>
      !("myDependency" in ((await readJson("package.json")).devDependencies ?? {})),
    do: () => exec("npm i myDependency"),
    undo: () => exec("npm r myDependency"),
  },
  {
    name: "Create basic config",
    if: async () => !(await exists(".my-dependency.rc")),
    do: () => writeJson(".my-dependency.rc", {
      projectName: (await readJson("package.json")).name ?? "my-project"
    }),
    willChange: [".my-dependency.rc"]
  },
]);
```

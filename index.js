const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { join } = require("path");

/**
 * Logs to the console
 */
const log = msg => console.log(`\n${msg}`); // eslint-disable-line no-console

/**
 * Exits the current process with an error code and message
 */
const exit = msg => {
	console.error(msg);
	process.exit(1);
};

/**
 * Executes the provided shell command and redirects stdout/stderr to the console
 */
const run = (cmd, cwd) => execSync(cmd, { encoding: "utf8", stdio: "inherit", cwd });

/**
 * Determines the current operating system (one of ["mac", "windows", "linux"])
 */
const getPlatform = () => {
	switch (process.platform) {
		case "darwin":
			return "mac";
		case "win32":
			return "windows";
		default:
			return "linux";
	}
};

/**
 * Returns the value for an environment variable (or `null` if it's not defined)
 */
const getEnv = name => process.env[name.toUpperCase()] || null;

/**
 * Sets the specified env variable if the value isn't empty
 */
const setEnv = (name, value) => {
	if (value) {
		process.env[name.toUpperCase()] = value.toString();
	}
};

/**
 * Returns the value for an input variable (or `null` if it's not defined). If the variable is
 * required and doesn't have a value, abort the action
 */
const getInput = (name, required) => {
	const value = getEnv(`INPUT_${name}`);
	if (required && !value) {
		exit(`"${name}" input variable is not defined`);
	}
	return value;
};

/* 
 * Taken from https://stackoverflow.com/a/5878101.
 *
 * Function to test if an object is a plain object, i.e. is constructed
 * by the built-in Object constructor and inherits directly from Object.prototype
 * or null (e.g., const foo = Object.create(null)). Some built-in objects pass the test, 
 * e.g. Math which is a plain object and some host or exotic objects may pass also.
 */
const isPlainObject = (obj) => {
	// Basic check for type object that's not null
	if (typeof obj == "object" && obj !== null) {

		// If Object.getPrototypeOf supported, use it
		if (typeof Object.getPrototypeOf == "function") {
			var proto = Object.getPrototypeOf(obj);
			return proto === Object.prototype || proto === null;
		}
		
		// Otherwise, use internal class
		// This should be reliable as if getPrototypeOf not supported, is pre-ES5
		return Object.prototype.toString.call(obj) == "[object Object]";
	}

	// Not an object
	return false;
}

/**
 * Given configuration overrides as object, return a list of CLI args that can be 
 * passed directly to `electron-builder build` using its `-c...` override mechanism.
 * 
 * Example, given:
 * {
 *   extraMetadata: {
 *       version: "4.1.0",
 *   },
 *   releaseInfo: {
 *       releaseName: "foo",
 *       releaseNotes: "Some notes",
 *   },
 * }
 * 
 * Return:
 * ["-c.releaseInfo.releaseNotes=Some notes", "-c.releaseInfo.releaseName=foo", "-c.extraMetadata.version=4.1.0"]
 */
const transformConfigOverridesToCliArgs = (overrides) => {
	const stack = Object.entries(overrides);
	const cliArgs = [];

	while (stack.length) {
		const [path, value] = stack.pop();
		if (!isPlainObject(value)) {
			cliArgs.push(`-c.${path}=${value}`);
		} else {
			Object.entries(value).forEach(([key, value]) => {
				stack.push([`${path}.${key}`, value])
			});
		}
	}

	return cliArgs;
};

/**
 * Installs NPM dependencies and builds/releases the Electron app
 */
const runAction = () => {
	const platform = getPlatform();
	const release = getInput("release", true) === "true";
	const pkgRoot = getInput("package_root", true);
	const configOverrides = JSON.parse(getInput("config_overrides") || "{}");

	// TODO: Deprecated option, remove in v2.0. `electron-builder` always requires a `package.json` in
	// the same directory as the Electron app, so the `package_root` option should be used instead
	const appRoot = getInput("app_root") || pkgRoot;

	const pkgJsonPath = join(pkgRoot, "package.json");
	const pkgLockPath = join(pkgRoot, "package-lock.json");

	// Determine whether NPM should be used to run commands (instead of Yarn, which is the default)
	const useNpm = existsSync(pkgLockPath);
	log(`Will run ${useNpm ? "NPM" : "Yarn"} commands in directory "${pkgRoot}"`);

	// Make sure `package.json` file exists
	if (!existsSync(pkgJsonPath)) {
		exit(`\`package.json\` file not found at path "${pkgJsonPath}"`);
	}

	// Copy "github_token" input variable to "GH_TOKEN" env variable (required by `electron-builder`)
	setEnv("GH_TOKEN", getInput("github_token", true));

	// Require code signing certificate and password if building for macOS. Export them to environment
	// variables (required by `electron-builder`)
	if (platform === "mac") {
		setEnv("CSC_LINK", getInput("mac_certs"));
		setEnv("CSC_KEY_PASSWORD", getInput("mac_certs_password"));
	} else if (platform === "windows") {
		setEnv("CSC_LINK", getInput("windows_certs"));
		setEnv("CSC_KEY_PASSWORD", getInput("windows_certs_password"));
	}

	// Disable console advertisements during install phase
	setEnv("ADBLOCK", true);

	log(`Installing dependencies using ${useNpm ? "NPM" : "Yarn"}…`);
	run(useNpm ? "npm install" : "yarn", pkgRoot);

	// Run NPM build script if it exists
	log("Running the build script…");
	if (useNpm) {
		run("npm run build --if-present", pkgRoot);
	} else {
		// TODO: Use `yarn run build --if-present` once supported
		// https://github.com/yarnpkg/yarn/issues/6894
		const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
		if (pkgJson.scripts && pkgJson.scripts.build) {
			run("yarn build", pkgRoot);
		}
	}

	log(`Building${release ? " and releasing" : ""} the Electron app…`);

	const runner = useNpm ? "npx --no-install" : "yarn run"
	const executable = "electron-builder";
	const platformArg = `--${platform}`;
	const releaseArg = release ? "--publish always" : ""
	const configOverrideArgs = transformConfigOverridesToCliArgs(configOverrides);

	const script = [
		runner,
		executable,
		platformArg,
		releaseArg,
		...configOverrideArgs
	].join(" ");

	log(`Running: ${script}`);
	run(script, appRoot);
};

runAction();

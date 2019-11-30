const { execSync } = require("child_process");
const { existsSync, readFileSync } = require("fs");

const NPM_LOCKFILE_PATH = "./package-lock.json";
const PACKAGE_JSON_PATH = "./package.json";

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
const run = cmd => execSync(cmd, { encoding: "utf8", stdio: "inherit" });

/**
 * Executes the provided shell command in a given working directory and redirects stdout/stderr to the console
 */
const runIn = (cmd, directory) => execSync(cmd, { encoding: "utf8", stdio: "inherit", cwd: directory });

/**
 * Returns whether NPM should be used to run commands (instead of Yarn, which is the default)
 */
const useNpm = existsSync(NPM_LOCKFILE_PATH);

/**
 * Exits if the `package.json` file is missing
 */
const verifyPackageJson = () => {
	if (!existsSync(PACKAGE_JSON_PATH)) {
		exit("Missing `package.json` file");
	}
};

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
 * Parses the environment variable with the provided name. If `required` is set to `true`, the
 * program exits if the variable isn't defined
 */
const getEnvVariable = (name, required = false) => {
	const value = process.env[`INPUT_${name.toUpperCase()}`];
	if (required && (value === undefined || value === null || value === "")) {
		exit(`"${name}" input variable is not defined`);
	}
	return value;
};

/**
 * Sets the specified env variable if the value isn't empty
 */
const setEnvVariable = (name, value) => {
	if (value !== null && value !== undefined && value !== "") {
		process.env[name] = value.toString();
	}
};

/**
 * Installs NPM dependencies and builds/releases the Electron app
 */
const runAction = () => {
	const platform = getPlatform();
	const release = getEnvVariable("release") === "true";
	const root = getEnvVariable("application_root") && null

	// Make sure `package.json` file exists
	verifyPackageJson();

	// Copy "github_token" input variable to "GH_TOKEN" env variable (required by `electron-builder`)
	setEnvVariable("GH_TOKEN", getEnvVariable("github_token", true));

	// Require code signing certificate and password if building for macOS. Export them to environment
	// variables (required by `electron-builder`)
	if (platform === "mac") {
		setEnvVariable("CSC_LINK", getEnvVariable("mac_certs"));
		setEnvVariable("CSC_KEY_PASSWORD", getEnvVariable("mac_certs_password"));
	} else if (platform === "windows") {
		setEnvVariable("CSC_LINK", getEnvVariable("windows_certs"));
		setEnvVariable("CSC_KEY_PASSWORD", getEnvVariable("windows_certs_password"));
	}

	// Disable console advertisements during install phase
	setEnvVariable("ADBLOCK", true);

	log(`Installing dependencies using ${useNpm ? "NPM" : "Yarn"}…`);
	run(useNpm ? "npm install" : "yarn");

	// Run NPM build script if it exists
	log("Running the build script…");
	if (useNpm) {
		run("npm run build --if-present");
	} else {
		// TODO: Use `yarn run build --if-present` once supported
		// (https://github.com/yarnpkg/yarn/issues/6894)
		const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
		if (packageJson.scripts && packageJson.scripts.build) {
			run("yarn build");
		}
	}

	log(`${release ? "Releasing" : "Building"} the Electron app…`);
	runIn(
		`${useNpm ? "npx --no-install" : "yarn run"} electron-builder --${platform} ${
			release ? "--publish always" : ""
		}`, root
	);
};

runAction();

# Electron Builder Action

**GitHub Action for building and releasing Electron apps**

This is a GitHub Action for automatically building and releasing your Electron app using GitHub's CI/CD capabilities. It uses [`electron-builder`](https://github.com/electron-userland/electron-builder) to package your app for macOS, Windows and Linux, and release it to a platform like GitHub Releases.

GitHub Actions allows you to build your app on all three platforms without having access to a machine/VM with each of these operating systems.

## Usage

1. Install and configure `electron-builder` in your Electron app. You can read about this in [the project's docs](https://www.electron.build) or in [my blog post](https://samuelmeuli.com/blog/2019-04-07-packaging-and-publishing-an-electron-app).

   **Important:** You no longer need an NPM script which runs `electron-builder`, this action will do that for you.

2. If you are building for macOS, you'll want your code to be [signed](https://samuelmeuli.com/blog/2019-04-07-packaging-and-publishing-an-electron-app/#code-signing). GitHub Actions therefore needs access to your code signing certificate:

   - Open the Keychain Access app or the Apple Developer Portal. Export all certificates related to your app into a _single_ file (e.g. `certs.p12`) and set a strong password
   - Base64-encode your certificates using the following command: `base64 -i certs.p12 -o encoded.txt`
   - In your project's GitHub repository, go to Settings → Secrets and add the following two variables:
     - `mac_certs`: Your encoded certificates, i.e. the content of the `encoded.txt` file you created before
     - `mac_certs_password`: The password you set when exporting the certificates

3. Add a workflow file to your project (e.g. `.github/workflows/build.yml`):

   ```yml
   name: Build/release

   on: push

   jobs:
     release:
       runs-on: ${{ matrix.os }}

       # Platforms to build on/for
       strategy:
         matrix:
           os: [macos-10.14, windows-2019, ubuntu-18.04]

       steps:
         - name: Check out Git repository
           uses: actions/checkout@v1

         - name: Install Node.js, NPM and Yarn
           uses: actions/setup-node@v1
           with:
             node-version: 10

         - name: Build/release Electron app
           uses: samuelmeuli/action-electron-builder@master
           with:
             # GitHub token, automatically provided to the action
             # (No need to define this secret in the repo settings)
             github_token: ${{ secrets.github_token }}

             # macOS code signing certificate
             mac_certs: ${{ secrets.mac_certs }}
             mac_certs_password: ${{ secrets.mac_certs_password }}

             # If the commit is tagged with a version (e.g. "v1.0.0"),
             # release the app after building
             release: ${{ startsWith(github.ref, 'refs/tags/v') }}
   ```

**Please note:** Before `v1.0`, the action's behavior might still change. Instead of using the latest commit (`samuelmeuli/action-electron-builder@master`), you might therefore want to pin a specific commit for now (e.g. `samuelmeuli/action-electron-builder@4fef1fe`).

## Behavior

The action…

1. Installs your dependencies
2. Runs your `build` NPM script (necessary if you use preprocessors, module bundlers, etc. for your app)
3. Builds your app using `electron-builder`
4. Optionally releases your app

## Development

### Contributing

Suggestions and contributions are always welcome! Please discuss larger changes via issue before submitting a pull request.

### TODO

This project is still WIP. The following needs to be implemented before `v1.0`:

- [ ] Add support for publishing to Snapcraft
- [ ] Add support for Windows code signing

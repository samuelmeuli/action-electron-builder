# Electron Builder Action

**GitHub Action for building and releasing Electron apps**

This is a GitHub Action for automatically building and releasing your Electron app using GitHub's CI/CD capabilities. It uses [`electron-builder`](https://github.com/electron-userland/electron-builder) to package your app and release it to a platform like GitHub Releases.

GitHub Actions allows you to build your app on macOS, Windows and Linux without needing direct access to each of these operating systems.

## Setup

1. Install and configure `electron-builder` in your Electron app. You can read about this in [the project's docs](https://www.electron.build) or in [my blog post](https://samuelmeuli.com/blog/2019-04-07-packaging-and-publishing-an-electron-app).

2. If you have a `build` script in `package.json`, make sure it does **not** run `electron-builder`. This action will do that for you.

3. If you are building for macOS, you'll want your code to be [signed](https://samuelmeuli.com/blog/2019-04-07-packaging-and-publishing-an-electron-app/#code-signing). GitHub Actions therefore needs access to your code signing certificate:

   - Open the Keychain Access app or the Apple Developer Portal. Export all certificates related to your app into a _single_ file (e.g. `certs.p12`) and set a strong password
   - Base64-encode your certificates using the following command: `base64 -i certs.p12 -o encoded.txt`
   - In your project's GitHub repository, go to Settings → Secrets and add the following two variables:
     - `mac_certs`: Your encoded certificates, i.e. the content of the `encoded.txt` file you created before
     - `mac_certs_password`: The password you set when exporting the certificates

4. Add a workflow file to your project (e.g. `.github/workflows/build.yml`):

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

## Usage

### Building

Using this the workflow above, GitHub will build your app every time you push a commit.

### Releasing

When you want to create a new release, follow these steps:

1. Update the version in your project's `package.json` file (e.g. `1.2.3`)
2. Commit that change (`git commit -am v1.2.3`)
3. Tag your commit (`git tag v1.2.3`). Make sure your tag name's format is `v*.*.*`. Your workflow will use this tag to detect when to create a release
4. Push your changes to GitHub (`git push && git push --tags`)

After building successfully, the GitHub action will then publish your release artifacts. By default, a new release draft will be created on GitHub with download links for your app. If you want to change this behavior, have a look at the [`electron-builder` docs](https://www.electron.build).

## Development

### Contributing

Suggestions and contributions are always welcome! Please discuss larger changes via issue before submitting a pull request.

### TODO

This project is still WIP. The following needs to be implemented before `v1.0`:

- [ ] Add support for publishing to Snapcraft
- [ ] Add support for Windows code signing
- [ ] Use a tag in the sample workflow

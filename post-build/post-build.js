const path = require('path');
const fs = require('fs');
const util = require('util');

// get application version from package.json
const appVersion = require('../package.json').version;

// promisify core API's
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

console.log('\nRunning post-build tasks');

// our version.json will be in the build folder
const versionFilePath = path.join(__dirname + '/../build/version.json');
const configFile = path.join(__dirname + '/../build/web.config');

let mainHash = '';
let mainBundleFile = '';

// RegExp to find main-es5.hash.js, even if it doesn't include a hash in it's name (dev build)
let mainBundleRegexp = /^main.?([a-z0-9]*)?(\.bundle)?.js$/;
// let mainBundleRegexp = /^main-es5.?([a-z0-9]*)?.js$/;

// read the build folder files and find the one we're looking for
readDir(path.join(__dirname, '../build/'))
  .then(files => {
    mainBundleFile = files.find(f => mainBundleRegexp.test(f));

    if (mainBundleFile) {
      let matchHash = mainBundleFile.match(mainBundleRegexp);
      // if it has a hash in it's name, mark it down
      if (matchHash.length > 1 && !!matchHash[1]) {
        mainHash = matchHash[1];
      }
    }
    // write current version and hash into the version.json file
    const src = `{"version": "${appVersion}", "hash": "${(+new Date).toString(36)}"}`;
    const configJSON = `<?xml version="1.0" encoding="UTF-8"?>
    <configuration>
        <system.webServer>
        <rewrite>
        <rules>
          <rule name="AngularJS Routes" stopProcessing="true">
            <match url="^((?!api).)*$" />
                <conditions logicalGrouping="MatchAll">
                              <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                              <!-- <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" /> -->
                              <add input="{REQUEST_FILENAME}" pattern="(.*?)\.html$" negate="true" />
                              <add input="{REQUEST_FILENAME}" pattern="(.*?)\.js$" negate="true" />
                              <add input="{REQUEST_FILENAME}" pattern="(.*?)\.css$" negate="true" />

                </conditions>
                <action type="Rewrite" url="/" />
          </rule>
        </rules>
        </rewrite>
        <staticContent>
            <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
        </staticContent>
      </system.webServer>
    </configuration>`;
    writeFile(configFile, configJSON);
    return writeFile(versionFilePath, src);
  }).then(() => {
    // main bundle file not found, dev build?
    if (!mainBundleFile) {
      return;
    }
    console.log(`Replacing hash in the ${mainBundleFile}`);
    // replace hash placeholder in our main.js file so the code knows it's current hash
    const mainFilepath = path.join(__dirname, '../build/', mainBundleFile);
    return readFile(mainFilepath, 'utf8')
      .then(mainFileData => {
        // const newHash = mainHash + '' + new Date().getTime();
        const replacedFile = mainFileData.replace('{{POST_BUILD_ENTERS_HASH_HERE}}', mainHash);
        return writeFile(mainFilepath, replacedFile);
      });
  }).catch(err => {
    console.log('Error with post build:', err);
  });

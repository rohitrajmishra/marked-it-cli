/**
 * marked-it-cli
 *
 * Copyright (c) 2018 IBM Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const fse = require("fs-extra");
const path = require("path");
const jsYaml = require("js-yaml");

let logger;
const FILENAME_INCLUDES_GEN_TOC_ORDER_YAML = "toc_includes_gen.yaml"

function parseTopicsRecursive(topics, sourcePath) {
  let resData = [];
  // console.log(topics);
  for (const topic of topics) {
    // console.log(topic);
    if (typeof topic === 'string') {
      resData.push(topic)
    } else if (topic?.include) {
      console.log('Found include keyword!')
      console.log(topic.include);
      // Moddify the include keyword for further processing
      let result = topic.include.split('/');
      // console.log(result);
      // console.log("Shift array");
      result.shift();
      const otherRepoRoot = result[0];
      // Create otherRepoRoot in main-repo
      const srcFilePath = `${sourcePath}/${topic.include}`;
      const destDir = `${sourcePath}/includes/${otherRepoRoot}/`;
      // console.log(destDir);
      // Create otherRepoRoot to store included files later
      fse.mkdirpSync(destDir);

      // TODO: confirm: can included files be inside nested subfolders?
      const includedFileName = result[1];
      // const includedFileName = topic.include;
      console.log(includedFileName);

      // Copy other-repo to main repo
      const destFilePath = `${destDir}${includedFileName}`;

      // To copy a file, NOTE: fse.copySync does not supprot file to dir copy like cp, syntax is srcFilePath to destFilePath 
      try {
        console.log("Copying included file to main-repo...\n");
        console.log("srcFilePath: ", srcFilePath, '\n', "destFilePath: ", destFilePath);
        fse.copySync(srcFilePath, destFilePath);
        console.log("Successfully copied");
      } catch (err) {
        console.error(err)
      }

      // Replace include keyword with topic
      // console.log(result);
      topic.include = result.join('/')
      topic.topic = topic.include;
      delete topic.include;
      // console.log(topic);
      resData.push(topic.topic)
    } else if (typeof topic?.topic === 'string') {
      resData.push(topic.topic)
    } else if (typeof topic?.topicgroup?.topics === 'object') {
      parseTopicsRecursive(topic?.topicgroup?.topics, sourcePath)
    }
  }
  // console.log("All topics: ", resData);
  return;
}

// Process jsonData and parse topics for include keyword
function preProcessJson(jsonData, sourcePath) {
  for (entry of jsonData.toc.entries) {
    if (entry?.navgroup) {
      parseTopicsRecursive(entry?.navgroup?.topics, sourcePath);
    }
    if (entry?.topics) {
      parseTopicsRecursive(entry?.topics, sourcePath);
    }

  }
  return jsonData;
}

// main
const init = function (initData) {
  logger = initData.logger;
  logger.info("Started inclueds extension...");

  // Read toc.yaml file
  try {
    logger.info("Processing toc.yaml");
    let raw = fse.readFileSync(`${sourcePath}/toc.yaml`);

    // Convert yaml to json
    let data = jsYaml.safeLoad(raw);
    data = preProcessJson(data, sourcePath);

    // Write Json to yaml output back, useful to debug the processed output 
    const yamlOutput = jsYaml.safeDump(data);
    logger.info("Writing file toc_includes_gen.yaml");
    const outputFilename = FILENAME_INCLUDES_GEN_TOC_ORDER_YAML;
    const path_outputFilename = path.join(sourcePath, outputFilename);
    console.log(`path_outputFilename: ${path_outputFilename}`);
    // TODO: Cleanup intermediate temp file
    fse.writeFileSync(path_outputFilename, yamlOutput);
  } catch (err) {
    logger.error(err)
  }
}

module.exports.init = init;
module.exports.id = "includes";
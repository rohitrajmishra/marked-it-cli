/**
 * marked-it-cli
 *
 * Copyright (c) 2022 IBM Corporation
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

// Read the srcFile and check for other file references(such as images/videos)
function copyImageLinkFiles(srcFilePath, destDir) {
  logger.info(`Searching for img/video links to copy for file: ${srcFilePath}`)
  const srcFileDir = path.dirname(srcFilePath);
  // regex for syntax -> ![Image Link description](<image Link>)
  const img_re = /!\[[^\]]*\]\([^\)]*\)/g;

  try {
    let fileContent = fse.readFileSync(srcFilePath, "utf8");

    const match_image_links = fileContent.match(img_re);
    // Check if match_image_links is not falsy (null/undefined)
    if(match_image_links) {
      match_image_links.forEach(item => {
        // Extract img_filepath using substring method
        const img_filepath = item.substring(
          item.indexOf('(') + 1,
          item.lastIndexOf(')'));
        try {
          let src = `${srcFileDir}/${img_filepath}`;
          let dest = `${destDir}/${img_filepath}`;
          fse.copySync(src, dest);
        } catch (err) {
          logger.info(err)
        }
      });
    } else {
      logger.info(`No img/video links to copy for file: ${srcFilePath}`);
    }
  } catch (error) {
    // Throw error if not able to read the file
    logger.info(err);
  }
}

function processImageMatch(match, full_mdFilePath, destDir) {
  // Extract img_filepath using substring method
  const srcFileDir = path.dirname(full_mdFilePath);
  const start = match.indexOf('(') + 1;
  const end = match.lastIndexOf(')');
  const img_filepath = match.substring(start, end);

  let srcImagePath = path.resolve(`${srcFileDir}/${img_filepath}`);
  let destImagePath = path.resolve(`${destDir}/${img_filepath}`);
  let destImageDir = path.dirname(path.resolve(destImagePath));

  try {
    fse.ensureDirSync(destImageDir);
    fse.copySync(srcImagePath, destImagePath);
  } catch (err) {
    logger.info(err)
  }

  // Return new relative path for replacement
  // TODO: Take relative image path from output folder if required
  const updated_match = match.slice(0, start) + destImagePath + ')';
  return updated_match;
}

// Function to process image/video links in md fileContent
function processImageLinks(fileContent, mdFilePath, full_mdFilePath, inputDir) {
  // console.log(fileContent);
  logger.info(`Searching for img/video links in file: ${mdFilePath}`);
  // ^ -> beginning
  // \W -> Matches any character that is not a word character (alphanumeric & underscore). Equivalent to [^A-Za-z0-9_]
  const re = /^\W+/;
  // Create otherRepoRoot in main-repo
  // remove initial non alphanumeric characters like '../' and './' from file path
  const destRelativePath = mdFilePath.replace(re, '');

  // Get file name and dir path
  const baseDirName = path.dirname(destRelativePath);
  const baseFileName = path.basename(destRelativePath);

  const destDir = path.resolve(inputDir, 'includes', baseDirName);
  // Create directory structure for other-repo to get copied in
  try {
    fse.ensureDirSync(destDir);
  } catch (err) {
    logger.info(err)
  }

  // regex for syntax -> ![Image Link description](<image Link>)
  const img_re = /!\[[^\]]*\]\([^\)]*\)/g;

  try {
    fileContent = fileContent.replace(img_re, match => processImageMatch(match, full_mdFilePath, destDir));
  } catch (error) {
    // Throw error if not able to read the file
    logger.info(error);
  }

  return fileContent;
}

function parseTopicsRecursive(topics, sourcePath) {
  let resData = [];
  // ^ -> beginning
  // \W -> Matches any character that is not a word character (alphanumeric & underscore). Equivalent to [^A-Za-z0-9_]
  const re = /^\W+/;
  for (const topic of topics) {
    if (typeof topic === 'string') {
      resData.push(topic)
    } else if (topic?.include) {
      // Modify the include keyword for further processing
      // Create otherRepoRoot in main-repo
      let includeTopic = topic.include;
      const srcFilePath = path.resolve(sourcePath, includeTopic);
      // remove initial non alphanumeric characters like '../' and './' from file path
      const destRelativePath = includeTopic.replace(re, '');

      // Get file name and dir path
      const baseDirName = path.dirname(destRelativePath);
      const baseFileName = path.basename(destRelativePath);

      const destDir = path.resolve(sourcePath, 'includes', baseDirName);
      // Create directory structure for other-repo to get copied in
      try {
        fse.ensureDirSync(destDir);
      } catch (err) {
        logger.info(err)
      }
      // Copy other-repo to main repo
      const destFilePath = path.resolve(destDir, baseFileName);
      // To copy a file, NOTE: fse.copySync does not support file to dir copy like cp, syntax is srcFilePath to destFilePath 
      try {
        fse.copySync(srcFilePath, destFilePath);
        // Call function to check for other file references(such as images/videos)
        copyImageLinkFiles(srcFilePath, destDir);
      } catch (err) {
        // this file is not present, which is fine, just continue after displaying error
        logger.info(err)
      }

      // Replace include keyword with topic
      topic.include = destRelativePath;
      topic.topic = `includes/${topic.include}`;
      delete topic.include;
      resData.push(topic.topic)
    } else if (typeof topic?.topic === 'string') {
      resData.push(topic.topic)
    } else if (typeof topic?.topicgroup?.topics === 'object') {
      parseTopicsRecursive(topic?.topicgroup?.topics, sourcePath)
    }
  }
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
const init = function (data) {
  logger = data.logger;
  let sourcePath = data.sourcePath;
  logger.info("Started includes extension...");

  // Read toc.yaml file
  try {
    logger.info("Processing toc.yaml");
    let raw = fse.readFileSync(`${sourcePath}/toc.yaml`);

    // Convert yaml to json
    let data = jsYaml.safeLoad(raw);
    data = preProcessJson(data, sourcePath);

    // Write Json to yaml output back, useful to debug the processed output 
    const yamlOutput = jsYaml.safeDump(data);
    const outputFilename = FILENAME_INCLUDES_GEN_TOC_ORDER_YAML;
    const path_outputFilename = path.join(sourcePath, outputFilename);
    // TODO: Cleanup intermediate temp file
    fse.writeFileSync(path_outputFilename, yamlOutput);
  } catch (err) {
    logger.error(err)
  }
}

const toc = {};
// Function to check if intermediate toc file is generated after include processing and return yamlToc
toc.get = function (obj, data) {
  const sourcePath = data.sourcePath;

  let yamlToc;
  let yamlTocOrderPath;

  const outputFilename = FILENAME_INCLUDES_GEN_TOC_ORDER_YAML;
  const path_outputFilename = path.join(sourcePath, outputFilename)
  let yamlStat;
  try {
    yamlStat = fse.statSync(path_outputFilename);
  } catch (e) {
    // this file is not present, which is fine, just continue
  }
  if (yamlStat && yamlStat.isFile()) {
    try {
      return jsYaml.load(fse.readFileSync(path_outputFilename, 'utf8'));
    } catch (e) {
      logger.warning("Error found in " + path_outputFilename + ":\n" + e);
    }
  }
  return null;
}

const md = { variables: {} }
md.variables.add = function (obj, data) {
  const { sourcePath, fileText, parseMarkdownSections } = data;
  const sourceDirPath = path.dirname(sourcePath);
  logger.info("Processing file " + sourcePath);

  // Regex search for anything between '{{' and '}}'
  // const re = new RegExp('\{\{.+\.md\}\}', 'g');
  const re = /\{\{.+\.md\}\}/g;
  const matches = fileText.match(re);

  // Regex search for section ids
  const re_sections = /\{\{.+\.md#.+\}\}/g;
  const matches_section = fileText.match(re_sections);

  // Check for valid .md file paths in results
  if (matches) {
    matches.forEach(item => {
      const mdFilePath = item.substring(
        item.indexOf('{{') + 2,
        item.lastIndexOf('}}')
      );

      // Read mdFile and assign the content as key value pair in conrefMap
      const fullpath_mdFilePath = path.join(sourceDirPath, mdFilePath)
      let mdStat;
      let fileContent;

      try {
        mdStat = fse.statSync(fullpath_mdFilePath);
      } catch (e) {
        // this file is not present, which is fine, just continue
      }
      if (mdStat && mdStat.isFile()) {
        try {
          fileContent = fse.readFileSync(fullpath_mdFilePath, 'utf8');
          // Process content for links(image/videos)
          /* Function requires filecontent(string),
           and paths(to determine destDir to copy required files in includes/<other-repo-root-dir>),
           */
          const modifiedFileContent = processImageLinks(fileContent, mdFilePath, fullpath_mdFilePath, sourceDirPath);
          // Update the results
          // Key is mdFilePath
          obj[mdFilePath] = modifiedFileContent;

        } catch (e) {
          logger.warning("Error occurred reading variable-included file " + mdFilePath + ":\n" + e);
        }
      }
    });
  }

  // Check for sections in .md files
  if (matches_section) {
    matches_section.forEach(item => {
      const fullSectionId = item.substring(
        item.indexOf('{{') + 2,
        item.lastIndexOf('}}')
      );

      // Split file name and section Id(separator '#')
      const result = fullSectionId.split('#');
      const mdFilePath = result[0];
      const sectionId = result[1];

      // Read mdFile and assign the content as key value pair in conrefMap
      const fullpath_mdFilePath = path.join(sourceDirPath, mdFilePath)
      let mdStat;
      let fileContent;

      try {
        mdStat = fse.statSync(fullpath_mdFilePath);
      } catch (e) {
        // this file is not present, which is fine, just continue
      }
      if (mdStat && mdStat.isFile()) {
        try {
          fileContent = fse.readFileSync(fullpath_mdFilePath, 'utf8');
          // Update the results
          let parsedSections = parseMarkdownSections(fileContent, true);
          // Key is fullSectionId, that will be used in obj for further processing in conrefs
          obj[fullSectionId] = parsedSections[sectionId];
        } catch (e) {
          logger.warning("Error occurred reading variable-included file " + mdFilePath + ":\n" + e);
        }
      }
    });
  }
  return obj;
}

module.exports.init = init;
module.exports.toc = toc;
module.exports.md = md;
module.exports.id = "includes";
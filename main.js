import fsp from 'fs/promises';
import { parse } from 'csv-parse/sync';
import moment from 'moment';
import xml2js, { Builder } from 'xml2js';

import findMode from './findMode.js';
import CONFIG from './config.js';
const CSV_FOLDER_PATH = CONFIG().csvFolderPath;
const FILES_TO_PROCESS = CONFIG().csvFileNames;
const PARAM_NAMES = CONFIG().paramNames;
const EA_NAME = CONFIG().eaName;
const BACKTEST_RESULT_FOLDER = CONFIG().backtestResultFolder;
const FORWARDTEST_RESULT_FOLDER = CONFIG().forwardtestResultFolder;
const QUEUE_BACKTEST_XML_FOLDER = CONFIG().queueBacktestXmlFolder;

/**
 * Main function.
 * @param {string[]} args an array of programe argument
 * @returns 
 */
async function main(args) {
  console.log('Start of Programe.');

  // verify the parameter
  // - the parameter should be a path to the folder that contain all the 
  //   optimization result csv files.
  // - it should have exactly one parameter
  // if (args.length != 1) {
  //   console.error('Please provide path to the folder that contain all the optimization result xml files.');
  //   return;
  // }
  const folderPath = CSV_FOLDER_PATH;

  // Find and print out all the files that it will process.
  // Get the files in the follder
  const files = await fsp.readdir(folderPath);

  // Find and print out all the files that it will process.
  const filesToProcess = [];
  for (const file of files) {
    if (FILES_TO_PROCESS.includes(file)) {
      filesToProcess.push(file);
    }
  }
  if (filesToProcess.length > 0) {
    console.info(`Found ${filesToProcess.length} files in the folder:`);
    for (const file of filesToProcess) {
      console.info(`- ${file}`);
    }
  } else {
    console.error(`No file match with the defined filename.`);
    return;
  }

  // get the params with the best result. 
  const getBestRecordPromises = [];
  for (const fileToProcess of filesToProcess) {
    getBestRecordPromises.push((async _ => {
      // read csv files
      const filePath = folderPath + '\\' + fileToProcess;
      const fileContent = await fsp.readFile(filePath, "utf8");
      const records = parse(fileContent, {
        columns: true,
      });
      
      // find the record(s) with the best result
      const bestRecords = [];
      for (const record of records) {
        if (bestRecords.length > 0) {
          if (record.Result !== bestRecords[bestRecords.length - 1].Result) {
            break;
          }
        }
        bestRecords.push(record);
      }

      // find the mode value of the params of the best result
      const bestParam = {};
      for (const paramName of PARAM_NAMES) {
        const paramArray = bestRecords.map(bestRecord => bestRecord[paramName]);
        const modes = findMode(paramArray);
        bestParam[paramName] = modes[0];
      }

      // add instrutment name to bestParam
      const instrutmentName = fileToProcess.split('.')[0];
      bestParam.name = instrutmentName;

      return bestParam;
    })());
  }
  const bestParams = await Promise.all(getBestRecordPromises);

  // read sample *.set file
  const setFileTemplate = await fsp.readFile('template.set', 'utf16le');

  // generate *.set file for mt5
  const generateSetFilePromises = [];
  for (const bestParam of bestParams) {
    generateSetFilePromises.push((async _ => {
      let setFileContent = setFileTemplate;
      
      // replace datetime in template
      setFileContent = setFileContent.replace('{{datetime}}', moment().format('YYYY.MM.DD HH:mm:ss'));

      // replace eaName in template
      setFileContent = setFileContent.replace('{{eaName}}', EA_NAME);

      // replace params in template
      for (const paramName of PARAM_NAMES) {
        setFileContent = setFileContent.replace(`{{${paramName}}}`, bestParam[paramName]);
      }

      // write *.set file
      const filePath = folderPath + '\\' + bestParam.name + '.set';
      await fsp.writeFile(filePath, setFileContent, {
        encoding: 'utf16le',
      });
      
    })());
  }
  await Promise.all(generateSetFilePromises);

  // generate queueBacktest xml file
  const xmlObject = {
    queued: {
      backtest: []
    }
  }
  for (const bestParam of bestParams) {
    xmlObject.queued.backtest.push({
      eaName: EA_NAME,
      symbol: bestParam.name,
      InputSetFile: folderPath + '\\' + bestParam.name + '.set',
      backtestResultFolder: BACKTEST_RESULT_FOLDER,
      forwardtestResultFolder: FORWARDTEST_RESULT_FOLDER,
      completed: 'false'
    });
  }
  const xmlBuilder = new xml2js.Builder();
  const xml = xmlBuilder.buildObject(xmlObject);
  const xmlFilePath = QUEUE_BACKTEST_XML_FOLDER + '\\' + 'queueBacktest.xml';
  await fsp.writeFile(xmlFilePath, xml);

  console.log('End of Programe.');
}

export default main;

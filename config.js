// Configuration file

var config = {};

/**
 * WIKIA
 * The wikia's base URL
 */
config.wikia = 'http://jojo.wikia.com';

/**
 * START PAGE
 * The page to start the web scraper from
 */
config.startPage = '/wiki/Josuke_Higashikata';

/**
 * TEXT FOLDER
 * The folder where the web scraper will save the text files to
 */
config.textFolder = __dirname + '/pages/';

/**
 * TEXT STRIP REGEX
 * Regex to use to clean the scraped text
 */
 config.textStripRegex = /\[[0-9]+\]|\[[a-zA-Z]\]|\[citation needed\]/g;

 module.exports = config;
 
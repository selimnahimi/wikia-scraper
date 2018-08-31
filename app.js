"use strict";

const cheerio = require('cheerio')
	, fs = require('fs')
	, htmlToText = require('html-to-text')
	, request = require('request-promise-native')
	, setTitle = require('console-title')
	, config = require('./config.js');

const domain = config.wikia;

var textFolder = config.textFolder;

if(!textFolder.endsWith('/')) {
	textFolder += '/';
}

fs.stat(textFolder, (err, stat) => {
	if (!stat) fs.mkdir(textFolder, err => console.error(err));
});

let pageQueue = new Set([])
	, imgQueue = []
	, workers = []
	, queuePosition = 0;

/**
 * This function searches for links on a wiki article.
 * @param {string} url - URL to the current page
 */
function createJob(url) {
	return new Worker(url);
}

/**
 * This class is used to resolve URL downloads
 */
class Worker {
	constructor(url) {
		this.url = url;
		this.done = false;
		this.resolveUrl();
	}

	resolveUrl() {
		return request(this.url)
			.then(htmlString => downloadPageText(htmlString, this.url))
			.then(findLinks)
			//.then(findImages)
			//.then(images => {
			//	imgQueue.push(...images);
			//})
			.then(() => this.done = true)
			.catch(err => {});
	}
}

/**
 * Checks to see if the queue has any finished promises and removes them/adds new ones if necessary
 */
function checkQueue() {
	let jobsToAdd = 10 - workers.length;
	for (let i = 0; i < workers.length; i++) {
		if (!workers[i].done) continue;
		workers.splice(i, 1);
		jobsToAdd++;
	}

	for (let i = 0; queuePosition < pageQueue.size && jobsToAdd > 0; queuePosition++) {
		let url = [...pageQueue][queuePosition];
		workers.push(createJob(url));
		pageQueue.delete(url);
		jobsToAdd--;
	}

	setTitle('Workers: ' + workers.length + '/10, Queue: ' + pageQueue.size);
}

/**
 * Parses the html and writes the text of the wiki page to a file
 * @param {string} htmlString - String of the raw unparsed HTML
 * @param {string} url - URL to the current page
 */
function downloadPageText(htmlString, url) {
	return new Promise((resolve, reject) => {
		/*if (fs.existsSync(config.textFolder + url.replace(/\\|\//g, '~') + '.txt')) {
			console.info(`Already Downloaded ${url}`);
			reject('Page already downloaded');
		}*/
		console.log(`Loaded ${url}`);

		let $ = cheerio.load(htmlString)
			, text = "";

		let fname = url.replace(domain, '');
		    fname = encodeToHtml(fname);
		    fname = fname.replace(/\\|\//g, '~');
		    fname += '.txt';

		if (!fs.existsSync(textFolder + '/' + fname)) {
			$('body').find('p').each(function (i, elem) {
				text += " " + $(this).text() + " ";
			});

			text = htmlToText.fromString(text, {
				ignoreHref: true,
				ignoreImage: true,
				wordwrap: false
			});

			text = text.replace(config.textStripRegex, '').replace(/ {2,}/g, ' ');

			console.log(`Saving ${url}`);

			fs.writeFile(textFolder + '/' + fname, text, err => {
				if (err) {
					console.error(`Error saving ${url}: ${err}`);
					reject(err.message);
				}
				console.log(`Saved ${url}`);
				resolve([url, $]);
			});
		} else resolve([url, $]);
	})
}

/**
 * A function for converting normal text to their HTML entity equivalent using regex
 * This is used to prevent illegal filenames.
 * @param {string} text - the text to convert 
 */
function encodeToHtml(text) {
	return text.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
		return '&#'+i.charCodeAt(0)+';';
	});
}

/**
 * 
 * @param {CheerioStatic} param0 
 */
function findImages([pageUrl, $]) {
	return new Promise(function (resolve, reject) {
		let images = new Set([]);
		try {
			$('#mw-content-text .tabbertab img').map(function (i, elem) {
				let img = $(this).attr('src');
				//console.log('Found img: ' + img);
				if (typeof img !== 'undefined' && typeof $(this).attr('alt') !== 'undefined' && !img.startsWith('data:')) {
					images.add(img);
				}
			});
		} catch (err) {
			reject(err);
		}

		// Need a better name for this. It simply takes the url only output of our loop and makes it into an object with the page url (maybe use the destination instead?)
		let imagesCompiled = [];
		for (let imgUrl of images) {
			imagesCompiled.push({ imgUrl: imgUrl, pageUrl: pageUrl });
		}

		resolve(imagesCompiled);
	});
}


function findLinks([pageUrl, $]) {
	return new Promise(function (resolve, reject) {
		try {
			$('body').find('a').each(function (i, elem) {
				let link = $(this).attr('href');
				if (typeof link !== 'undefined' && link.startsWith('/wiki/')) {
					if (!link.match(/:|\*|\?|"|<|>|\|+/g)) {
						pageQueue.add(domain + link);
					}
				}
			});
		} catch (err) {
			reject(err);
		}

		resolve([pageUrl, $]);
	})
}


function SaveImg(imageurl, fname) {
	request(imageurl).pipe(fs.createWriteStream(fname))
}

pageQueue.add(domain + config.startPage);

setInterval(checkQueue, 100);

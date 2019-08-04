/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2019
 * @license LGPL-3.0
 */

const path = require('path');
const fs = require('fs-extra');
const Promise = require('bluebird');

const ThumbGenerator = require('../lib/ThumbnailGenerator');
const thumbGen = new ThumbGenerator({verbose: true});

const inputDir = path.join(__dirname, 'files');
const outputDir = path.join(__dirname, 'thumbs');

const files = fs.readdirSync(inputDir);
let i = 0;

const createThumbPromise = (index) => {
    if (index >= files.length) return Promise.resolve();

    const file = files[index];
    const parsed = path.parse(file);
    const inPath = path.join(inputDir, file);
    const outPath = path.join(outputDir, `${parsed.name}.thumb.jpg`);
    
    return thumbGen.getThumbnail({
        path: inPath,
        output: outPath,
        size: 300,
        quality: 70,
    })
        .then(thumbnailPath => {
            if (!thumbnailPath) console.log(`${file}: Could not generate the thumbnail!`);
            else console.log(`${file}: Thumbnail generated! Find it here: ${outPath}`);
        })
        .then(() => createThumbPromise(index + 1));
};

createThumbPromise(0)
    .catch(error => console.error(`Unexpected error occurred: ${error}`));


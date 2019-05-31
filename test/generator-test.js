/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2019
 * @license LGPL-3.0
 */

const path = require('path');

const ThumbGenerator = require('../lib/ThumbnailGenerator');
const thumbGen = new ThumbGenerator({verbose: true});

const input = path.join(__dirname, 'images', 'google-example.webp');
const output = path.join(__dirname, 'thumbs', 'google-example.thumb.jpg');

thumbGen.getThumbnail({
    path: input,
    output: output,
    size: 300,
    quality: 70,
})
    .then(thumbnailPath => {
        if (!thumbnailPath) console.log('Could not generate the thumbnail!');
        else console.log(`Thumbnail generated! Find it here: ${thumbnailPath}`);
    });

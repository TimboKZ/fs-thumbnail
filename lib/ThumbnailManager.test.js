/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2019
 * @license LGPL-3.0
 */

const assert = require('assert');
const {describe, it} = require('mocha');

const ThumbnailManager = require('./ThumbnailManager');
const thumbManager = new ThumbnailManager({
    verbose: true, // Whether to print out warning/errors
    size: [500, 300], // Default size, either a single number of an array of two numbers - [width, height].
    quality: 70, // Default quality, between 1 and 100
});

thumbManager.getThumbnail({
    path: '/path/to/my/image.png',
    output: '/thumbnail/folder/thumbnail.jpg',
    size: 300,
    quality: 70,
})
    .then(thumbnailPath => {
        if (!thumbnailPath) console.log('Could not generate the thumbnail!');
        else console.log(`Thumbnail generated! Find it here: ${thumbnailPath}`);
    });

// describe('ThumbnailManager', function () {
//     describe('#indexOf()', function () {
//         it('should return -1 when the value is not present', function () {
//             assert.equal([1, 2, 3].indexOf(4), -1);
//         });
//     });
// });

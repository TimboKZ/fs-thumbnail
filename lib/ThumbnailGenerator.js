/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2019
 * @license LGPL-3.0
 */

const path = require('path');
const fs = require('fs-extra');
const Promise = require('bluebird');
const ffmpeg = require('fluent-ffmpeg');
const ExactTrie = require('exact-trie');

const Prefix = '[fs-thumbnail]';

// Load peer dependencies if they are available
const LibNames = {
    sharp: 'sharp',
};
const Libs = {};
const LibLoaded = {};
for (const key in LibNames) {
    const name = LibNames[key];
    try {
        Libs[name] = require(name);
        LibLoaded[name] = true;
    } catch (error) {
        console.log(`[fs-thumbnail] Could not import "${name}" package. Relevant features are disabled. (Reason: ${error.message})`);
        LibLoaded[name] = false;
    }
}

// Prepare tries for different libraries
const supportedExtensions = {};
supportedExtensions[LibNames.sharp] = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'gif', 'svg'];
const LibTries = {};
for (const name in supportedExtensions) {
    // Skip libraries that are not loaded
    if (!LibLoaded[name]) continue;

    // Generate the trie
    const trie = new ExactTrie();
    const exts = supportedExtensions[name];
    for (let i = 0; i < exts.length; ++i) {
        trie.put(exts[i], true, true);
    }
    LibTries[name] = trie;
}

class ThumbnailGenerator {

    /**
     * @private
     */
    static _getValue(value, fallback) {
        return value === undefined ? fallback : value;
    };

    /**
     * @param {object} [options]
     * @param {boolean} [options.verbose]
     * @param {number|number[]} [options.size]
     * @param {number} [options.quality]
     */
    constructor(options = {}) {
        this.verbose = ThumbnailGenerator._getValue(options.verbose, false);
        this.size = ThumbnailGenerator._getValue(options.size, 220);
        this.quality = ThumbnailGenerator._getValue(options.quality, 60);

        this.functionsToTry = [
            ['sharp', (data) => this._trySharp(data)],
            ['ffmpeg 5%', (data) => this._tryFluentFfmpeg(data, '5%')],
            ['ffmpeg raw', (data) => this._tryFluentFfmpeg(data)],
        ];
    }

    /**
     * @param {object} data
     * @param {string} data.path Relative or absolute path to the input file.
     * @param {string} data.output Relative or absolute path to the output image file.
     * @param {number|number[]} data.size
     * @param {number} data.quality
     * @private
     */
    _trySharp(data) {
        const p = data.path;
        const o = data.output;
        const s = data.size;
        const q = data.quality;

        return new Promise((resolve, reject) => {
            try {
                const libName = LibNames.sharp;
                if (!LibLoaded[libName]) return resolve(null);
                if (LibTries[libName] && !LibTries[libName].hasWithCheckpoints(p, '.', true)) {
                    return resolve(null);
                }

                const input = Libs[LibNames.sharp](p, {failOnError: false});
                const resize = typeof s === 'number' ? input.resize(s) : input.resize(s[0], s[1]);
                resize
                    .jpeg({quality: q})
                    .toFile(o)
                    .then(() => resolve(o))
                    .catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * @param {object} data
     * @param {string} data.path Absolute path to the input file.
     * @param {string} data.output Absolute path to the output image file.
     * @param {number|number[]} data.size
     * @param {number} data.quality
     * @param {string} [timestamp]
     * @private
     */
    _tryFluentFfmpeg(data, timestamp = null) {
        const p = data.path;
        const o = data.output;
        const s = data.size;
        const q = data.quality;

        return new Promise((resolve, reject) => {
            try {
                const outData = path.parse(o);
                const size = typeof s === 'number' ? `${s}x?` : `${s[0]}x${s[1]}`;

                const screenshotOpts = {
                    filename: outData.base,
                    folder: outData.dir,
                    size: size,
                };
                if (timestamp) screenshotOpts.timestamps = [timestamp],

                ffmpeg(p)
                    .on('error', error => reject(error))
                    .on('end', () => resolve(o))
                    .screenshots(screenshotOpts);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * @param {object} data
     * @param {string} data.path Relative or absolute path to the input file.
     * @param {string} data.output Relative or absolute path to the output image file.
     * @param {number|number[]} [data.size]
     * @param {number} [data.quality]
     */
    getThumbnail(data) {
        let fullData;
        return Promise.resolve()
            .then(() => {
                fullData = {
                    path: path.resolve(data.path),
                    output: path.resolve(data.output),
                    size: data.size || this.size,
                    quality: data.quality || this.quality,
                };

                return fs.lstat(fullData.path);
            })
            .then(stats => {
                // Can't generate thumbnails for directories
                if (stats.isDirectory()) return null;

                let currPromise = Promise.resolve();
                for (let i = 0; i < this.functionsToTry.length; ++i) {
                    const name = this.functionsToTry[i][0];
                    const func = this.functionsToTry[i][1];

                    currPromise = currPromise
                        .then(result => {
                            if (result) return result;

                            return func(fullData)
                                .then(result => {
                                    if (result) return result;
                                    if (!this.verbose) return;
                                    console.warn(`${Prefix} "${name}" could not generate a thumbnail.`);
                                })
                                .catch(err => {
                                    if (!this.verbose) return;
                                    console.error(`${Prefix} "${name}" failed. Reason: ${err.message}`);
                                });
                        });
                }

                return currPromise;
            });
    }

}

module.exports = ThumbnailGenerator;

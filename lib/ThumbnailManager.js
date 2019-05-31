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

class ThumbnailManager {

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
        this.verbose = ThumbnailManager._getValue(options.verbose, false);
        this.size = ThumbnailManager._getValue(options.size, 220);
        this.quality = ThumbnailManager._getValue(options.quality, 60);

        this.functionsToTry = [this._trySharp, this._tryFluentFfmpeg];
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
                if (LibTries[libName] && !LibTries[libName].has(data.path, true)) resolve(null);
                console.log(LibTries[libName].has(data.path, true));
                console.log(LibTries[libName] && !LibTries[libName].has(data.path, true));

                const input = Libs[LibNames.sharp](p, {failOnError: false});
                const resize = typeof s === 'number' ? input.resize(s) : input.resize(s[0], s[1]);
                resize
                    .jpeg({quality: q})
                    .toFile(o, err => {
                        if (err) return reject(err);
                        resolve(o);
                    });
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
     * @private
     */
    _tryFluentFfmpeg(data) {
        const p = data.path;
        const o = data.output;
        const s = data.size;
        const q = data.quality;

        return new Promise((resolve, reject) => {
            try {
                const outData = path.parse(o);
                const size = typeof s === 'number' ? `${s}x?` : `${s[0]}x${s[1]}`;

                ffmpeg(p)
                    .on('error', error => reject(error))
                    .on('end', () => resolve(o))
                    .screenshots({
                        timestamps: ['6%'],
                        filename: outData.base,
                        folder: outData.dir,
                        size: size,
                    });
            } catch (error) {
                reject(error);
            }
        });
    }

    _resolveWithFallback(promise, fallback, name, data) {
        if (!promise) promise = Promise.resolve();

        return promise
            .then(result => {
                if (result) return result;
                return fallback(data).catch(error => {
                    if (this.verbose) console.error(`[fs-thumbnail] "${name}" failed. Reason: ${error.message}`);
                    return fallback(data);
                });
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

                let currPromise = null;
                for (let i = 0; i < this.functionsToTry.length; ++i) {
                    const func = this.functionsToTry[i];
                    currPromise = this._resolveWithFallback(currPromise, func, func.name, fullData);
                }

                return currPromise;
            });
    }

}

module.exports = ThumbnailManager;

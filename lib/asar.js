(function() {
  var Filesystem, crawlFilesystem, createSnapshot, disk, fs, minimatch, mkdirp, os, path;

  fs = require('original-fs');

  path = require('path');

  os = require('os');

  minimatch = require('minimatch');

  mkdirp = require('mkdirp');

  Filesystem = require('./filesystem');

  disk = require('./disk');

  crawlFilesystem = require('./crawlfs');

  createSnapshot = require('./snapshot');

  module.exports.createPackage = function(src, dest, callback) {
    return module.exports.createPackageWithOptions(src, dest, {}, callback);
  };

  module.exports.createPackageWithOptions = function(src, dest, options, callback) {
    var dot;
    dot = options.dot;
    if (dot === void 0) {
      dot = true;
    }
    return crawlFilesystem(src, {
      dot: dot
    }, function(error, filenames, metadata) {
      var file, filename, files, filesystem, shouldUnpack, _i, _len;
      if (error) {
        return callback(error);
      }
      filesystem = new Filesystem(src);
      files = [];
      for (_i = 0, _len = filenames.length; _i < _len; _i++) {
        filename = filenames[_i];
        file = metadata[filename];
        switch (file.type) {
          case 'directory':
            filesystem.insertDirectory(filename);
            break;
          case 'file':
            shouldUnpack = options.unpack ? minimatch(filename, options.unpack, {
              matchBase: true
            }) : false;
            files.push({
              filename: filename,
              unpack: shouldUnpack
            });
            filesystem.insertFile(filename, shouldUnpack, file.stat);
            break;
          case 'link':
            filesystem.insertLink(filename, file.stat);
        }
      }
      return mkdirp(path.dirname(dest), function(error) {
        if (error) {
          return callback(error);
        }
        return disk.writeFilesystem(dest, filesystem, files, function(error) {
          if (error) {
            return callback(error);
          }
          if (options.snapshot) {
            return createSnapshot(src, dest, filenames, metadata, options, callback);
          } else {
            return callback(null);
          }
        });
      });
    });
  };

  module.exports.statFile = function(archive, filename, followLinks) {
    var filesystem;
    filesystem = disk.readFilesystemSync(archive);
    return filesystem.getFile(filename, followLinks);
  };

  module.exports.listPackage = function(archive) {
    return disk.readFilesystemSync(archive).listFiles();
  };

  module.exports.extractFile = function(archive, filename) {
    var filesystem;
    filesystem = disk.readFilesystemSync(archive);
    return disk.readFileSync(filesystem, filename, filesystem.getFile(filename));
  };

  module.exports.extractAll = function(archive, dest) {
    var content, destFilename, error, file, filename, filenames, filesystem, followLinks, linkDestPath, linkSrcPath, linkTo, relativePath, _i, _len, _results;
    filesystem = disk.readFilesystemSync(archive);
    filenames = filesystem.listFiles();
    followLinks = process.platform === 'win32';
    mkdirp.sync(dest);
    _results = [];
    for (_i = 0, _len = filenames.length; _i < _len; _i++) {
      filename = filenames[_i];
      filename = filename.substr(1);
      destFilename = path.join(dest, filename);
      file = filesystem.getFile(filename, followLinks);
      if (file.files) {
        _results.push(mkdirp.sync(destFilename));
      } else if (file.link) {
        linkSrcPath = path.dirname(path.join(dest, file.link));
        linkDestPath = path.dirname(destFilename);
        relativePath = path.relative(linkDestPath, linkSrcPath);
        try {
          fs.unlinkSync(destFilename);
        } catch (_error) {
          error = _error;
        }
        linkTo = path.join(relativePath, path.basename(file.link));
        _results.push(fs.symlinkSync(linkTo, destFilename));
      } else {
        content = disk.readFileSync(filesystem, filename, file);
        _results.push(fs.writeFileSync(destFilename, content));
      }
    }
    return _results;
  };

}).call(this);

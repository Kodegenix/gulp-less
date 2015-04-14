var path           = require('path');
var accord         = require('accord');
var through2       = require('through2');
var gutil          = require('gulp-util');
var assign         = require('object-assign');
var applySourceMap = require('vinyl-sourcemaps-apply');

var PluginError    = gutil.PluginError;
var less           = accord.load('less');

module.exports = function (options) {
  // Mixes in default options.
  options = assign({}, {
      compress: false,
      paths: []
    }, options);

  return through2.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }

    if (file.isStream()) {
      return cb(new PluginError('gulp-less', 'Streaming not supported'));
    }

    var str = file.contents.toString();

    // Clones the options object
    var opts = assign({}, options);

    // Injects the path of the current file
    opts.filename = file.path;

    // Bootstrap source maps
    if (file.sourceMap) {
      /*
      (jc) If I comment out the line 48, I am getting the following error in tests:
      ---- from npm test
      Potentially unhandled rejection [4] Error: ENOENT, open 'buttons.less'
      at Error (native)

      Error: timeout of 2000ms exceeded. Ensure the done() callback is being called in this test.
      ----

      Note that less itself is working just fine here, the above error must be stemming from accord
      */
      opts.sourcemap = true;

      /*
      (jc) This option must be overwritten in accord when line 48 is not commented out, because I am still getting absolute paths in sourceMap.sources
      Again, less itself is working just fine, those options are documented in less, and they SHOULD work as documented even with accord IMHO
      */
      var basepath = path.resolve(file.base);
      opts.sourceMap = {
        sourceMapBasepath: basepath
      }
    }

    less.render(str, opts).then(function(res) {
      file.contents = new Buffer(res.result);
      file.path = gutil.replaceExtension(file.path, '.css');
      if (res.sourcemap) {
        res.sourcemap.file = file.relative;
        /*
        (jc) This fix is just being made too late, there is no knowing what have made some other paths in sources
        absolute or relative, or event relative to other directories, etc. User might be doing something bit more complex here
        */
        //res.sourcemap.sources = res.sourcemap.sources.map(function (source) {
        //  return path.relative(file.base, source);
        //});

        applySourceMap(file, res.sourcemap);
      }
      return file;
    }).then(function(file) {
      cb(null, file);
    }).catch(function(err) {
      // Convert the keys so PluginError can read them
      err.lineNumber = err.line;
      err.fileName = err.filename;

      // Add a better error message
      err.message = err.message + ' in file ' + err.fileName + ' line no. ' + err.lineNumber;

      throw new PluginError('gulp-less', err);
    }).done(undefined, cb);
  });
};

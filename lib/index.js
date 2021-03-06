var _        = require('lodash');
var apidoc   = require('apidoc-core');
var fs       = require('fs-extra');
var markdown = require('marked');
var path     = require('path');
var winston  = require('winston');

var PackageInfo = require('./package_info');

var defaults = {
    dest    : path.join(__dirname, '../doc/'),
    template: path.join(__dirname, '../template/'),

    debug   : false,
    silent  : false,
    verbose : false,
    simulate: false,
    parse   : false, // only parse and return the data, no file creation
    colorize: true,
    markdown: true,

    marked: {
        gfm        : true,
        tables     : true,
        breaks     : false,
        pedantic   : false,
        sanitize   : false,
        smartLists : false,
        smartypants: false
    }
};

var app = {
    log     : {},
    markdown: false,
    options : {}
};

// uncaughtException
process.on('uncaughtException', function(err) {
    console.error((new Date()).toUTCString() + ' uncaughtException:', err.message);
    console.error(err.stack);
    process.exit(1);
});

/**
 * Create the documentation
 *
 * @param  {Object} options See defaults and apidoc-core defaults for all options / `apidoc --help`
 * @returns {Mixed} true = ok, but nothing todo | false = error | Object with parsed data and project-informations.
 */
function createDoc(options) {
    var api;
    var apidocPath = path.join(__dirname, '../');
    var packageInfo;

    _.defaults(options, defaults);

    // paths
    options.dest     = path.join(options.dest, './');
    options.template = path.join(options.template, './');

    // options
    app.options = options;

    // logger
    app.log = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({
                level      : app.options.debug ? 'debug' : app.options.verbose ? 'verbose' : 'info',
                silent     : app.options.silent,
                prettyPrint: true,
                colorize   : app.options.colorize,
                timestamp  : false
            }),
        ]
    });

    // markdown
    if(app.options.markdown === true) {
        app.markdown = markdown;
        app.markdown.setOptions(app.options.marked);
    }

    try {
        packageInfo = new PackageInfo(app);

        // generator information
        var json = JSON.parse( fs.readFileSync(apidocPath + 'package.json', 'utf8') );
        apidoc.setGeneratorInfos({
            name   : json.name,
            time   : new Date(),
            url    : json.homepage,
            version: json.version
        });
        apidoc.setLogger(app.log);
        apidoc.setMarkdownParser(app.markdown);
        apidoc.setPackageInfos(packageInfo.get());

        api = apidoc.parse(app.options);

        if (api === true) {
            app.log.info('Nothing to do.');
            return true;
        }
        if (api === false)
            return false;

        if (app.options.parse !== true)
            createOutputFiles(api);

        app.log.info('Done.');
        return api;
    } catch(e) {
        app.log.error(e.message);
        if (e.stack)
            app.log.debug(e.stack);
        return false;
    }
}

/**
 * Save parsed data to files
 *
 * @param {Object[]} blocks
 * @param {Object} packageInfos
 */
function createOutputFiles(api) {
    if (app.options.simulate)
        app.log.warn('!!! Simulation !!! No file or dir will be copied or created.');

    app.log.verbose('create dir: ' + app.options.dest);
    if ( ! app.options.simulate)
        fs.mkdirsSync(app.options.dest);

    app.log.verbose('copy template ' + app.options.template + ' to: ' + app.options.dest);
    if ( ! app.options.simulate)
        fs.copySync(app.options.template, app.options.dest);

    // Write api_data
    app.log.verbose('write json file: ' + app.options.dest + 'api_data.json');
    if( ! app.options.simulate)
        fs.writeFileSync(app.options.dest + './api_data.json', api.data);

    app.log.verbose('write js file: ' + app.options.dest + 'api_data.js');
    if( ! app.options.simulate)
        fs.writeFileSync(app.options.dest + './api_data.js', 'define({ "api": ' + api.data + ' });');

    // Write api_project
    app.log.verbose('write json file: ' + app.options.dest + 'api_project.json');
    if( ! app.options.simulate)
        fs.writeFileSync(app.options.dest + './api_project.json', api.project);

    app.log.verbose('write js file: ' + app.options.dest + 'api_project.js');
    if( ! app.options.simulate)
        fs.writeFileSync(app.options.dest + './api_project.js', 'define(' + api.project + ');');
}

module.exports = {
    createDoc: createDoc
};

/**
 * Copyright 2010 Jive Software
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*global jstestdriver QUnit */

/**
 * QUnitTestRunnerPlugin is a plugin for JsTestDriver that allows QUnit tests
 * to run using the QUnit test framework itself.  To use include this file and
 * the attached modified copy of QUnit as dependencies in your JsTestDriver
 * configuration.
 */
var QUnitTestRunnerPlugin = (function(window, $) {

    var QUNIT_TYPE = 'qunit'
      , DEFAULT_TIMEOUT = 5000  // default timeout for each async test in milliseconds
      , plugin = {}
      , doneModules = {};

    var config = {
        queue: [],
        autorun: true,
        blocking: false,
        semaphore: 0,
        deferTimeout: 5000,
        processTimeout: 50
    };

    function dirname(file) {
        var index = file.lastIndexOf("/");
        var length = file.length;
        return file.substring(0, index);
    }

    function filename(file) {
        var index = file.lastIndexOf("/");
        var length = file.length;
        return file.substring(index + 1, file.length);
    }

    function synchronize( callback ) {
        config.queue.push( callback );

        if ( config.autorun && !config.blocking ) {
            process();
        }
    }

    function process() {
        if (config.semaphore == 0) {
            config.semaphore += 1;
            setTimeout(function() {
                config.queue.shift()();
                config.semaphore -= 1;
            }, 13);
        } else {
            setTimeout( process , config.processTimeout );
        }
    }

    function defer(test, callback, timeout, startTime) {
        var startTime = startTime || (new Date()).getTime();
        var timeout = timeout || config.deferTimeout;
        synchronize(function() {
            if (test()) {
                callback();
            } else {
                if ((((new Date()).getTime() - startTime) > timeout))
                    defer(test, callback, timeout, startTime);
            }
        });
    }

    plugin.fn = {
        dirname: dirname,
        filename: filename
    };

    /**
     * Part of the JsTestDriver plugin API, specifies the name of this plugin.
     */
    plugin.name = 'QUnitTestRunnerPlugin';

    /**
     * This method is part of the JsTestDriver plugin API.  It is called to run
     * all of the tests in a specified module.
     */
    plugin.runTestConfiguration = function(testRunConfiguration, onTestDone, onTestRunConfigurationComplete) {
        console.log("runTestConfiguration");

        // Handle this set of tests if it is a QUnit module.
        if (testRunConfiguration.getTestCaseInfo().getType() == QUNIT_TYPE) {
            runTests(testRunConfiguration, onTestDone, onTestRunConfigurationComplete);
            return true;
        } else {
            return false;
        }
    };

    plugin.loadSource = function (file, onSourceLoad) {
        var supports = /.html$/.test(file.fileSrc);
        if (supports) {
            this.loadHtml(file, onSourceLoad);
        }
        return supports;
    }

    plugin.loadHtml = function(file, onSourceLoad) {

        var exception;

        function findElement(parent, localName, callback) {
            var result = null;

            if (parent.childNodes) {
                $.each(parent.childNodes, function(i, e) {
                    if (e.localName === localName) {
                        result = e;
                    }
                });
            }

            return result;
        };

        var relocation = dirname(file.fileSrc) + "/";

        $.ajax({
            url: relocation + filename(file.fileSrc),
            async : false,
            success: function( data ) {
                try {
                    $("body").append("<iframe id='temp-frame' name='temp-frame' seamless='' sandbox='' style='display:none' />");
                    $("body").append("<div id='for-replacement' />");
                    var frame = document.getElementById("temp-frame").contentDocument;
                    frame.write(data);

                    var frameHtml, frameHead, frameBody;

                    function isHtmlReady() {
                        frameHtml = findElement(frame, 'html');
                        return frameHtml != null;
                    }

                    function isHeadReady() {
                        frameHead = findElement(frameHtml, 'head');
                        return frameHead != null;
                    }

                    function isBodyReady() {
                        frameBody = findElement(frameHtml, 'body');
                        return frameBody != null;
                    }

                    function replaceDocument() {
                        replaceBody();
                        injectStylesheets();
                    }

                    function replaceBody() {
                        var adoptedBody = document.importNode(frameBody, true);
                        $("html body div#for-replacement").replaceWith($(adoptedBody.children));
                    }

                    function injectStylesheets() {
                        $("html head link[rel='stylesheet']", frame).each(function(index, element) {
                            var adoptedStylesheet = $(document.importNode(element, true));
                            adoptedStylesheet.attr('href', relocation + adoptedStylesheet.attr('href'));
                            $("html head").append($(adoptedStylesheet));
                        });
                    }

                    config.processTimeout = 50;
                    defer(isHtmlReady, function() {
                        config.processTimeout = 500;
                        defer(isBodyReady, function() {
                            replaceDocument();
                            onSourceLoad({ file: file, success: true, message: null });
                        });
                    });

                    // copy all JavaScripts
                    //            $("html head script:not([src$='qunit.js']):not([src$='same.js']:not([src$='unit-tests.js'])", frame).each(function(index, element) {
                    //                var src = '/test/sizzle/test/' + $(this).attr('src');
                    //                console.log(src);
                    //                var head= document.getElementsByTagName('head')[0];
                    //                var script= document.createElement('script');
                    //                script.type= 'text/javascript';
                    //                script.src= src;
                    //                head.appendChild(script);
                    //            });

                } catch(e) {
                    exception = e;
                    alert("Exception: " + e);
                }
            }
        });

        if (exception) {
            throw exception;
        }
    }

    /**
     * This method determines which QUnit modules are run when you pass a
     * `--tests` option to JsTestDriver.
     */
    plugin.getTestRunsConfigurationFor = function(testCaseInfos, expressions, testRunsConfiguration) {
        console.log("getTestRunsConfigurationFor");

        onBeforeStart();

        var i, j, foundOne = false, testCase;

        // Find QUnit test cases with names that match any of the given expressions.
        for (i = 0; i < testCaseInfos.length; i += 1) {
            testCase = testCaseInfos[i];
            if (testCase.getType() == QUNIT_TYPE) {
                for (j = 0; j < expressions.length; j += 1) {
                    if ("all" == expressions[j] || testCase.getTestCaseName() === expressions[j]) {
                        registerTestCaseinQUnit(testCase.getDefaultTestRunConfiguration());
                        testRunsConfiguration.push(testCase.getDefaultTestRunConfiguration());
                        foundOne = true;
                        break;  // break out of the inner loop
                    }
                }
            }
        }

        return foundOne;
    };

    function onBeforeStart() {
//        preload();

        QUnit.begin = function(callback) {
            console.log("begin");
            runCallback('begin', arguments);
        };

        QUnit.done = function() {
            console.log("done");
            runCallback('done',arguments);
        };


        QUnit.moduleStart = function() {
            console.log("moduleStart");
            runCallback('moduleStart', arguments);
        };



        QUnit.testStart = function() {
            console.log("testStart ");
            runCallback('testStart', arguments);
            captureConsole();
        };

        QUnit.config.autorun = false;
        QUnit.load();
    }

    function registerTestCaseinQUnit(testRunConfiguration) {
        var info = testRunConfiguration.getTestCaseInfo()
            , moduleName = info.getTestCaseName()
            , testEnvironment = info.getTemplate().prototype
            , tests = info.getTemplate().tests;

        // build module
        QUnit.module.call(null, moduleName, testEnvironment);

        // build tests
        for (var i = 0; i < tests.length; i += 1) {
            QUnit.test.apply(null, tests[i]);
        }
    }

    plugin.onTestsStart = function() {
        console.log("onTestStart");



//        QUnit.start();


    };

    plugin.onTestsFinish = function() {
        console.log("onTestsFinish");
    };

    /* Capture QUnit API calls to hook them into the JSTestDriver API. */

    var currentTestCase;


    window.module = function(name, testEnvironment) {
        currentTestCase = jstestdriver.testCaseBuilder.TestCase(
            name,
            testEnvironment,
            QUNIT_TYPE
        );
    
        currentTestCase.tests = [];
    };
    
    window.test = function() {
        currentTestCase.tests.push(arguments);
    };

    window.asyncTest = QUnit.asyncTest = function(testName, expected, callback) {
        if ( arguments.length === 2 ) {
            callback = expected;
            expected = 0;
        }

        window.test(testName, expected, callback, true);
    };

    // Time out async tests after the default timeout interval if no overriding
    // interval is given.
//    var origStop = QUnit.stop;
//    window.stop = QUnit.stop = function(timeout) {
//        return origStop(timeout || DEFAULT_TIMEOUT);
//    };


    var callbacks = {};
    var phases = ['begin', 'end', 'moduleStart', 'moduleDone', 'testStart', 'testDone'];

    function registerCallback(phase, callback) {
        callbacks[phase] = callbacks[phase] || [];
        callbacks[phase].push(callback);
    }

    function runCallback(phase, parameters) {
        if (callbacks[phase]) {
            for (var key in callbacks[phase]) {
                callbacks[phase][key].apply(QUnit, parameters);
            }
        }
    }

    for (var key in phases) {
        QUnit[phases[key]] = (function(phase) {
            return function(callback) {
                registerCallback(phase, callback);
            };
        })(phases[key]);
    }

    // One-time QUnit initialization.


    return plugin;


    /**
     * Runs all of the tests in one QUnit module.
     */
    function runTests(testRunConfiguration, onTestDone, onModuleDone) {
        var info = testRunConfiguration.getTestCaseInfo()
          , moduleName = info.getTestCaseName()
          , testEnvironment = info.getTemplate().prototype
          , tests = info.getTemplate().tests;



        var callbacks = {};

        var config = QUnit.config;



        QUnit.moduleDone = function(params) {
            console.log("moduleDone");
            if (!doneModules[params.name]) {
                doneModules[params.name] = true;
                runCallback('moduleDone', arguments);
                onModuleDone();
            }
        };

        QUnit.testDone = function(params) {
            restoreConsole();
            console.log("testDone");
            var copy = $.extend({}, params);
            delete copy.failures;
            runCallback('testDone', [copy]);

            var testResult = buildTestResult(params);
            onTestDone(testResult);
        };
    }

    function buildTestResult(params) {
        var result = params.failed === 0 ? 'passed' : 'failed'
            , message = params.failures[0] || ''
            , log = jstestdriver.console.getAndResetLog()
            , duration = 0;  // TODO: capture test duration


        return new jstestdriver.TestResult(
            params.module, params.name, result, message, log, duration
        );
    }

    var restoreConsole;

    function captureConsole() {
        var logMethod = console.log
          , logDebug = console.debug
          , logInfo = console.info
          , logWarn = console.warn
          , logError = console.error;

        console.log = function() { logMethod.apply(console, arguments); jstestdriver.console.log.apply(jstestdriver.console, arguments); };
        console.debug = function() { logDebug.apply(console, arguments); jstestdriver.console.debug.apply(jstestdriver.console, arguments); };
        console.info = function() { logInfo.apply(console, arguments); jstestdriver.console.info.apply(jstestdriver.console, arguments); };
        console.warn = function() { logWarn.apply(console, arguments); jstestdriver.console.warn.apply(jstestdriver.console, arguments); };
        console.error = function() { logError.apply(console, arguments); jstestdriver.console.error.apply(jstestdriver.console, arguments); };

        restoreConsole = function() {
            console.log = logMethod;
            console.debug = logDebug;
            console.info = logInfo;
            console.warn = logWarn;
            console.error = logError;  
        };
    }
})(this, jstestdriver.jQuery);

// Registers this plugin with JsTestDriver.
jstestdriver.pluginRegistrar.register(QUnitTestRunnerPlugin);
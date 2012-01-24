(function (window, $, pluginRegistrar) {

    var config = {
        queue: [],
        autorun: true,
        blocking: false,
        semaphore: 0,
        deferTimeout: 5000,
        processTimeout: 50
    };

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

    var QUnitRunner = {

        name:'QUnitRunner',

        /**
         * loadSource
         *
         * By defining the method loadSource a plugin can implement its own way of loading certain types of
         * files.
         *
         * loadSource takes 2 parameters:
         *  - file: A file object defined as -> { fileSrc: string, timestamp: number, basePath: string }
         *    fileSrc is the name of the file
         *    timestamp is the last modified date of the file
         *    basePath is defined if the file is a URL and the URL has been rewritten
         *  - onSourceLoad: A callback that must be called once the file has been loaded the callback takes
         *    1 parameter defined as -> { file: file object, success: boolean, message: string }
         *    file: A file object
         *    success: a boolean, true if the file was loaded successfully, false otherwise
         *    message: an error message if the file wasn't loaded properly
         *
         *  loadSource must return a boolean:
         *  - true if the plugin knows how to and loaded the file
         *  - false if the plugin doesn't know how to load the file
         *
         *  A simple loadSource plugin would look like:
         *
         *  var myPlugin = {
         *    name: 'myPlugin',
         *    loadSource: function(file, onSourceLoad) {
         *      // load the file
         *      return true;
         *    }
         *  }
         */
        loadSource:function (file, onSourceLoad) {
            var supports = /.html$/.test(file.fileSrc);
            if (supports) {
                this.loadHtml(file, onSourceLoad);
            }
            return supports;
        },

        loadHtml:function(file, onSourceLoad) {

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

            var relocation = "/test/qunit/test/";

            $.ajax({
                url: relocation + "index.html",
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
                        //            $("html head script:not([src$='qunit.js']):not([src$='same.js']:not([src$='test.js'])", frame).each(function(index, element) {
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

    };

    pluginRegistrar.register(QUnitRunner);

})(this, jstestdriver.jQuery, jstestdriver.pluginRegistrar);
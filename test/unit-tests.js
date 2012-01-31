module("jstd-qunit-tests");

var functions = QUnitTestRunnerPlugin.fn;

test("dirname tests", function() {
    var dirname = functions.dirname;
    equal(dirname("simple/test.txt"), "simple");
    equal(dirname("longer/path/test.txt"), "longer/path");
    equal(dirname("no-dir.txt"), "");
});

test("filename tests", function() {
    var filename = functions.filename;
    equal(filename("simple/test.txt"), "test.txt");
    equal(filename("longer/path/test.txt"), "test.txt");
    equal(filename("no-dir.txt"), "no-dir.txt");
});
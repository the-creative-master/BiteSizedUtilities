/* JSHC Haskell-to-JS compiler & runtime (MIT/BSD) */
if (typeof window === "undefined") var window = self;

// --- src/Utility/stacktrace.js ---
// Domain Public by Eric Wendelin http://eriwen.com/ (2008)
//                  Luke Smith http://lucassmith.name/ (2008)
//                  Loic Dachary <loic@dachary.org> (2008)
//                  Johan Euphrosine <proppy@aminche.com> (2008)
//                  Øyvind Sean Kinsey http://kinsey.no/blog (2010)
//                  Victor Homyakov <victor-homyakov@users.sourceforge.net> (2010)
//
// Information and discussions
// http://jspoker.pokersource.info/skin/test-printstacktrace.html
// http://eriwen.com/javascript/js-stack-trace/
// http://eriwen.com/javascript/stacktrace-update/
// http://pastie.org/253058
//
// guessFunctionNameFromLines comes from firebug
//
// Software License Agreement (BSD License)
//
// Copyright (c) 2007, Parakey Inc.
// All rights reserved.
//
// Redistribution and use of this software in source and binary forms, with or without modification,
// are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above
//   copyright notice, this list of conditions and the
//   following disclaimer.
//
// * Redistributions in binary form must reproduce the above
//   copyright notice, this list of conditions and the
//   following disclaimer in the documentation and/or other
//   materials provided with the distribution.
//
// * Neither the name of Parakey Inc. nor the names of its
//   contributors may be used to endorse or promote products
//   derived from this software without specific prior
//   written permission of Parakey Inc.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
// IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
// IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
// OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

/**
 * Main function giving a function stack trace with a forced or passed in Error 
 *
 * @cfg {Error} e The error to create a stacktrace from (optional)
 * @cfg {Boolean} guess If we should try to resolve the names of anonymous functions
 * @return {Array} of Strings with functions, lines, files, and arguments where possible 
 */
function printStackTrace(options) {
    var ex = (options && options.e) ? options.e : null;
    var guess = options ? !!options.guess : true;
    
    var p = new printStackTrace.implementation();
    var result = p.run(ex);
    return (guess) ? p.guessFunctions(result) : result;
}

printStackTrace.implementation = function() {};

printStackTrace.implementation.prototype = {
    run: function(ex) {
        ex = ex ||
            (function() {
                try {
                    this.undef();
                    return null;
                } catch (e) {
                    return e;
                }
            })();
        // Use either the stored mode, or resolve it
        var mode = this._mode || this.mode(ex);
        if (mode === 'other') {
            return this.other(arguments.callee);
        } else {
            return this[mode](ex);
        }
    },
    
    /**
     * @return {String} mode of operation for the environment in question.
     */
    mode: function(e) {
        if (e['arguments']) {
            return (this._mode = 'chrome');
        } else if (typeof window !== 'undefined' && window.opera && e.stacktrace) {
            return (this._mode = 'opera10');
        } else if (e.stack) {
            return (this._mode = 'firefox');
        } else if (typeof window !== 'undefined' && window.opera && !('stacktrace' in e)) { //Opera 9-
            return (this._mode = 'opera');
        }
        return (this._mode = 'other');
    },

    /**
     * Given a context, function name, and callback function, overwrite it so that it calls
     * printStackTrace() first with a callback and then runs the rest of the body.
     * 
     * @param {Object} context of execution (e.g. window)
     * @param {String} functionName to instrument
     * @param {Function} function to call with a stack trace on invocation
     */
    instrumentFunction: function(context, functionName, callback) {
        context = context || window;
        context['_old' + functionName] = context[functionName];
        context[functionName] = function() { 
            callback.call(this, printStackTrace());
            return context['_old' + functionName].apply(this, arguments);
        };
        context[functionName]._instrumented = true;
    },
    
    /**
     * Given a context and function name of a function that has been
     * instrumented, revert the function to it's original (non-instrumented)
     * state.
     *
     * @param {Object} context of execution (e.g. window)
     * @param {String} functionName to de-instrument
     */
    deinstrumentFunction: function(context, functionName) {
        if (context[functionName].constructor === Function &&
                context[functionName]._instrumented &&
                context['_old' + functionName].constructor === Function) {
            context[functionName] = context['_old' + functionName];
        }
    },
    
    /**
     * Given an Error object, return a formatted Array based on Chrome's stack string.
     * 
     * @param e - Error object to inspect
     * @return Array<String> of function calls, files and line numbers
     */
    chrome: function(e) {
        return e.stack.replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@').split('\n');
    },

    /**
     * Given an Error object, return a formatted Array based on Firefox's stack string.
     * 
     * @param e - Error object to inspect
     * @return Array<String> of function calls, files and line numbers
     */
    firefox: function(e) {
        return e.stack.replace(/(?:\n@:0)?\s+$/m, '').replace(/^\(/gm, '{anonymous}(').split('\n');
    },

    /**
     * Given an Error object, return a formatted Array based on Opera 10's stacktrace string.
     * 
     * @param e - Error object to inspect
     * @return Array<String> of function calls, files and line numbers
     */
    opera10: function(e) {
        var stack = e.stacktrace;
        var lines = stack.split('\n'), ANON = '{anonymous}',
            lineRE = /.*line (\d+), column (\d+) in ((<anonymous function\:?\s*(\S+))|([^\(]+)\([^\)]*\))(?: in )?(.*)\s*$/i, i, j, len;
        for (i = 2, j = 0, len = lines.length; i < len - 2; i++) {
            if (lineRE.test(lines[i])) {
                var location = RegExp.$6 + ':' + RegExp.$1 + ':' + RegExp.$2;
                var fnName = RegExp.$3;
                fnName = fnName.replace(/<anonymous function\:?\s?(\S+)?>/g, ANON);
                lines[j++] = fnName + '@' + location;
            }
        }
        
        lines.splice(j, lines.length - j);
        return lines;
    },
    
    // Opera 7.x-9.x only!
    opera: function(e) {
        var lines = e.message.split('\n'), ANON = '{anonymous}', 
            lineRE = /Line\s+(\d+).*script\s+(http\S+)(?:.*in\s+function\s+(\S+))?/i, 
            i, j, len;
        
        for (i = 4, j = 0, len = lines.length; i < len; i += 2) {
            //TODO: RegExp.exec() would probably be cleaner here
            if (lineRE.test(lines[i])) {
                lines[j++] = (RegExp.$3 ? RegExp.$3 + '()@' + RegExp.$2 + RegExp.$1 : ANON + '()@' + RegExp.$2 + ':' + RegExp.$1) + ' -- ' + lines[i + 1].replace(/^\s+/, '');
            }
        }
        
        lines.splice(j, lines.length - j);
        return lines;
    },
    
    // Safari, IE, and others
    other: function(curr) {
        var ANON = '{anonymous}', fnRE = /function\s*([\w\-$]+)?\s*\(/i,
            stack = [], fn, args, maxStackSize = 10;
        
        while (curr && stack.length < maxStackSize) {
            fn = fnRE.test(curr.toString()) ? RegExp.$1 || ANON : ANON;
            args = Array.prototype.slice.call(curr['arguments']);
            stack[stack.length] = fn + '(' + this.stringifyArguments(args) + ')';
            curr = curr.caller;
        }
        return stack;
    },
    
    /**
     * Given arguments array as a String, subsituting type names for non-string types.
     *
     * @param {Arguments} object
     * @return {Array} of Strings with stringified arguments
     */
    stringifyArguments: function(args) {
        for (var i = 0; i < args.length; ++i) {
            var arg = args[i];
            if (arg === undefined) {
                args[i] = 'undefined';
            } else if (arg === null) {
                args[i] = 'null';
            } else if (arg.constructor) {
                if (arg.constructor === Array) {
                    if (arg.length < 3) {
                        args[i] = '[' + this.stringifyArguments(arg) + ']';
                    } else {
                        args[i] = '[' + this.stringifyArguments(Array.prototype.slice.call(arg, 0, 1)) + '...' + this.stringifyArguments(Array.prototype.slice.call(arg, -1)) + ']';
                    }
                } else if (arg.constructor === Object) {
                    args[i] = '#object';
                } else if (arg.constructor === Function) {
                    args[i] = '#function';
                } else if (arg.constructor === String) {
                    args[i] = '"' + arg + '"';
                }
            }
        }
        return args.join(',');
    },
    
    sourceCache: {},
    
    /**
     * @return the text from a given URL.
     */
    ajax: function(url) {
        var req = this.createXMLHTTPObject();
        if (!req) {
            return;
        }
        req.open('GET', url, false);
        req.setRequestHeader('User-Agent', 'XMLHTTP/1.0');
        req.send('');
        return req.responseText;
    },
    
    /**
     * Try XHR methods in order and store XHR factory.
     *
     * @return <Function> XHR function or equivalent
     */
    createXMLHTTPObject: function() {
        var xmlhttp, XMLHttpFactories = [
            function() {
                return new XMLHttpRequest();
            }, function() {
                return new ActiveXObject('Msxml2.XMLHTTP');
            }, function() {
                return new ActiveXObject('Msxml3.XMLHTTP');
            }, function() {
                return new ActiveXObject('Microsoft.XMLHTTP');
            }
        ];
        for (var i = 0; i < XMLHttpFactories.length; i++) {
            try {
                xmlhttp = XMLHttpFactories[i]();
                // Use memoization to cache the factory
                this.createXMLHTTPObject = XMLHttpFactories[i];
                return xmlhttp;
            } catch (e) {}
        }
    },

    /**
     * Given a URL, check if it is in the same domain (so we can get the source
     * via Ajax).
     *
     * @param url <String> source url
     * @return False if we need a cross-domain request
     */
    isSameDomain: function(url) {
        return url.indexOf(location.hostname) !== -1;
    },
    
    /**
     * Get source code from given URL if in the same domain.
     *
     * @param url <String> JS source URL
     * @return <Array> Array of source code lines
     */
    getSource: function(url) {
        if (!(url in this.sourceCache)) {
            this.sourceCache[url] = this.ajax(url).split('\n');
        }
        return this.sourceCache[url];
    },
    
    guessFunctions: function(stack) {
        for (var i = 0; i < stack.length; ++i) {
            var reStack = /\{anonymous\}\(.*\)@(\w+:\/\/([\-\w\.]+)+(:\d+)?[^:]+):(\d+):?(\d+)?/;
            var frame = stack[i], m = reStack.exec(frame);
            if (m) {
                var file = m[1], lineno = m[4]; //m[7] is character position in Chrome
                if (file && this.isSameDomain(file) && lineno) {
                    var functionName = this.guessFunctionName(file, lineno);
                    stack[i] = frame.replace('{anonymous}', functionName);
                }
            }
        }
        return stack;
    },
    
    guessFunctionName: function(url, lineNo) {
        var ret;
        try {
            ret = this.guessFunctionNameFromLines(lineNo, this.getSource(url));
        } catch (e) {
            ret = 'getSource failed with url: ' + url + ', exception: ' + e.toString();
        }
        return ret;
    },
    
    guessFunctionNameFromLines: function(lineNo, source) {
        var reFunctionArgNames = /function ([^(]*)\(([^)]*)\)/;
        var reGuessFunction = /['"]?([0-9A-Za-z_]+)['"]?\s*[:=]\s*(function|eval|new Function)/;
        // Walk backwards from the first line in the function until we find the line which
        // matches the pattern above, which is the function definition
        var line = "", maxLines = 10;
        for (var i = 0; i < maxLines; ++i) {
            line = source[lineNo - i] + line;
            if (line !== undefined) {
                var m = reGuessFunction.exec(line);
                if (m && m[1]) {
                    return m[1];
                } else {
                    m = reFunctionArgNames.exec(line);
                    if (m && m[1]) {
                        return m[1];
                    }
                }
            }
        }
        return '(?)';
    }
};


// --- src/Utility/assert.js ---

/*
http://wiki.commonjs.org/wiki/Unit_Testing/1.0
TODO: make a module. see http://wiki.commonjs.org/wiki/Modules/1.1
*/

assert = {};

assert.AssertionError = function(obj){
    //Error.call(this);
    //for(var k in this){
    //   document.write("key:"+k+",value:"+this[k]+"<br>");
    //}
    var err = new Error();  // error object used to initialize some members
    //if(this.stack === undefined)alert("no stack");
    //document.write(this.stack);

    // message, fileName, lineNumber, stack, name
    for(var k in err){
       this[k] = err[k];
       //document.write("key:"+k+",value:"+err[k]+"<br>");
    }

    this.name = "AssertionError";

    if( obj !== undefined ){
        this.message = obj.message;
        this.actual = obj.actual;
        this.expected = obj.expected;
    } else {
        // use default empty message from Error class.
        //this.message = err.message;
    }
};
assert.AssertionError.prototype = new Error(); //Error.prototype;
//assert.AssertionError.prototype.name = "Error";
//assert.AssertionError.prototype.constructor = assert.AssertionError;

assert.ok = function(guard, message){
    assert.equal(guard, true, message);
};

assert.equal = function(actual, expected, message){
    if( actual == expected ){
	return;
    }
    
    throw new assert.AssertionError({message: message,
				     actual: actual,
				     expected: expected});
};

assert.notEqual = function(actual, expected, message){
    if( actual != expected ){
	return;
    }

    throw new assert.AssertionError({message: message,
				     actual: actual,
				     expected: expected});
};
/*
assert.deepEqual = function(actual, expected, message){
    if( actual === expected )return;
    if( typeof actual == "object" &&
	typeof expected == "object" ){

	if( actual.prototype !== undefined &&
	    actual.prototype.hasOwnProperty !== undefined &&
	    expected.prototype !== undefined &&
	    expected.prototype.hasOwnProperty !== undefined &&
	    actual.prototype.hasOwnProperty.call !==
            expected.prototype.hasOwnProperty.call )
	    return;
	if( actual.prototype !== expected.prototype )
	    return;

	//check if same set of keys and equivalent values for every key pair.
	var ok = true;
	for(var key in actual){
	    //assert.deepEqual
	};
	if( ok )return;

	throw new assert.AssertionError({message: message,
					 actual: actual,
					 expected: expected});
    } else {
	assert.equal(actual, expected, message);
    }
};
*/


// --- src/Utility/utility.js ---

////////////////////////////////////////////////////////////////////////////////

var JSHC = new Object();
JSHC.Parser = new Object();
JSHC.Simplify = new Object();

modules = new Object();

////////////////////////////////////////////////////////////////////////////////

JSHC.getKeys = function(obj){
   var key,keys = [];
   for(key in obj){
      keys.push(key);
   }
   return keys;
};

JSHC.getValues = function(obj){
   var key,values = [];
   for(key in obj){
      values.push(obj[key]);
   }
   return values;
};

JSHC.showKeys = function(obj){
    var key,strs=[];
    for(k in obj){
       strs.push(k);
       strs.push("<br>");
    }
    strs.pop();
    return strs.join("");
};

JSHC.numberOfKeys = function(obj){
   var key,keys = 0;
   for(key in obj){
      keys = keys + 1;
   }
   return keys;
};

JSHC.alert = function(){
   var res = "";
   for(var arg=0 ; arg<arguments.length ; arg++){
       if (typeof arguments[arg] !== "string")
          res += "\n" + JSHC.showAST(arguments[arg]) + "\n";
       else
          res += arguments[arg];
   };
   alert(res);
};

////////////////////////////////////////////////////////////////////////////////

JSHC.deepCopy = function(obj){
    switch( typeof obj ){

    // immutable
    case "number":
    case "boolean":
    case "string":
    case "function":
        return obj;

    case "object":
        var clone = new Object;
        for(var key in obj){
            clone[key] = JSHC.deepCopy(obj[key]);
        }
        return clone;

    default:
        throw new Error("JSHC.deepCopy: missing case: "+typeof obj);
    }
};

////////////////////////////////////////////////////////////////////////////////

JSHC.showPos = function(pos){
    if( pos === undefined ){
        return "unknown position";
    }

    var line = (pos.last_line - pos.first_line > 0) ?
                (pos.first_line + "-" + pos.last_line) :
                pos.first_line;
    var column = (pos.last_column - pos.first_column > 0) ?
                (pos.first_column + "-" + pos.last_column) :
                pos.first_column;
    return "line " + line + ", column " + column;
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Utility/errors.js ---

////////////////////////////////////////////////////////////////////////////////

/*
  contains:
  * module name
  * position
  * message
  
  describes an error in the source code being compiled.
*/
JSHC.SourceError = function(mname, pos, message){
    //assert.ok( mname !== undefined );
    //assert.ok( pos !== undefined );
    assert.ok( message !== undefined );

    var err = new Error();  // error object used to initialize some members
    for(var k in err){
       this[k] = err[k];
    }

    this.name = "SourceError";
    this.mname = mname;
    this.pos = pos;
    this.message = message;
};
JSHC.SourceError.prototype = new Error();

JSHC.SourceError.prototype.toString = function(){
    return (this.message !== undefined ? this.message : "")
        +(this.pos !== undefined ? " at " + JSHC.showPos(this.pos) : "")
        +(this.mname !== undefined ? " in " + this.mname : "");
};

////////////////////////////////////////////////////////////////////////////////

/*
  describes an error in the compiler.
*/
JSHC.CompilerError = function(message){
    assert.ok( message !== undefined );

    var err = new Error();  // error object used to initialize some members
    for(var k in err){
       this[k] = err[k];
    }

    this.name = "CompilerError";
    this.message = message;
};
JSHC.CompilerError.prototype = new Error();

////////////////////////////////////////////////////////////////////////////////

/*
  describes an error in the runtime.
*/
JSHC.RuntimeError = function(message){
    assert.ok( message !== undefined );

    var err = new Error();  // error object used to initialize some members
    for(var k in err){
       this[k] = err[k];
    }

    this.name = "RuntimeError";
    this.message = message;
};
JSHC.RuntimeError.prototype = new Error();

JSHC.RuntimeError.prototype.toString = function() {
    return this.name + ": " + this.message;
};

////////////////////////////////////////////////////////////////////////////////

/*
  thrown inside the type checker when working with typing constraints.
  it is caught by the type checker a related value/modid/pos is added later on.
*/
JSHC.TypeConstraintError = function(type1,type2,opt_msg){
    assert.ok( type1 !== undefined );
    assert.ok( type2 !== undefined );

    var err = new Error();  // error object used to initialize some members
    for(var k in err){
       this[k] = err[k];
    }

    this.name = "TypeError";
    this.type1 = type1;
    this.type2 = type2;
    if( typeof opt_msg == "string" ){
        this.msg = opt_msg;
    }
};
JSHC.TypeConstraintError.prototype = new Error();

JSHC.TypeConstraintError.prototype.toString = function(){
    return (this.msg !== undefined ? this.msg+" in " : "")
        +(this.value !== undefined ? "value: " + this.value : "")
        +", expected: " + this.type1
        +", inferred: " + this.type2
        +(this.pos !== undefined ? ", at " + JSHC.showPos(this.pos) : "")
        +(this.mname !== undefined ? ", in " + this.mname : "");
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Utility/showError.js ---

/*
  returns a nice string representation of something that has been caught in a
  catch-clause.
  the parameter must be defined.
*/
JSHC.showError = function(err){
  assert.ok( err !== undefined, "parameter must be defined" );

  if( !(err instanceof Error) ){
      return "not an instance of Error:\n" + err;
  } else {  // instance of Error
    var error_text;

    // the toString() method should exist and give a long description.
    if( err.toString !== undefined ){
        error_text = err.toString().trim() + "\n\n";
    } else {
        error_text = "";
    }

    // test for common subclasses of Error so that one can add more
    // information in these cases, or just check for specific members.

    // ".message" exists in Error class, so should also exist in all subclasses.
    // this should be a short description.
    if( err.message !== undefined &&
        err.message instanceof String &&
        error_text.indexOf(err.message) === -1 ){
        error_text = "message: "+err.message+"\n"+error_text;
    }

    // if name exists, use it.
    if( err.name !== undefined &&
        err.name instanceof String &&
        error_text.indexOf(err.name) === -1 ){
        error_text = "name: "+err.name+"\n"+error_text;
    }

    // if the browser has a stack trace available and not already in the text
    // from toString(), then show it.
    if( err.stack !== undefined ){
        var trace = printStackTrace({e : err});
        error_text = error_text + "trace:\n\n" + trace.join('\n\n');
    }
  }
  return error_text;
};



// --- src/Utility/Names.js ---

////////////////////////////////////////////////////////////////////////////////

/*
  abstract class for names.
  all subclasses must contain a member "id", and if has a position in a source
  file it must also contain a "pos" with that position.
*/
JSHC.Name = function(){
};
JSHC.Name.prototype.equal = function(other){
    return this.id === other.id && this.name === other.name;
};

////////////////////////////////////////////////////////////////////////////////

// no location parameter as module names are never qualified and always global.
JSHC.ModName = function(id,pos){
    this.name = "modname";
    this.id = id;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.ModName.prototype = new JSHC.Name();
JSHC.ModName.prototype.toStringN = function(){
    return this.id;
};
JSHC.ModName.prototype.toStringQ = function(){
    return this.toStringN();
};
JSHC.ModName.prototype.toStringV = function(){
    return "module " + this.toStringQ();
};
JSHC.ModName.prototype.toString = JSHC.ModName.prototype.toStringN;

JSHC.ModName.prefixes = function(id){
    var prefixes = [];

    var startix = 0;
    while(true){
        var endix = id.indexOf(".", startix);
        if( endix === -1 ){
            prefixes.push(id);
            break;
        }
        prefixes.push(id.substr(startix,endix));
        startix = endix + 1;
    }
    return prefixes;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.TyCls = function(id,pos,loc){
    this.name = "tycls";
    if( loc !== undefined ){
        this.loc = loc;
        if( id.substr(0,loc.length) == loc ){
            id = id.substr(loc.length+1);
        }
    }
    this.id = id;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.TyCls.prototype = new JSHC.Name();
JSHC.TyCls.prototype.toStringN = function(){
    return this.id;
};
JSHC.TyCls.prototype.toStringQ = function(){
    return (this.loc===undefined ? "" : this.loc+".") + this.toStringN();
};
JSHC.TyCls.prototype.toStringV = function(){
    return "type class " + this.toStringQ();
};
JSHC.TyCls.prototype.toString = JSHC.TyCls.prototype.toStringN;

////////////////////////////////////////////////////////////////////////////////

// no location parameter as they are never top-level names.
JSHC.TyVar = function(id,pos){
    this.name = "tyvar";
    this.id = id;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.TyVar.prototype = new JSHC.Name();
JSHC.TyVar.prototype.toStringN = function(){
    return this.id;
};
JSHC.TyVar.prototype.toStringQ = function(){
    return this.toStringN();
};
JSHC.TyVar.prototype.toStringV = function(){
    return "type variable " + this.toStringQ();
};
JSHC.TyVar.prototype.toString = JSHC.TyVar.prototype.toStringN;

////////////////////////////////////////////////////////////////////////////////

JSHC.TyCon = function(id,pos,loc){
    this.name = "tycon";
    if( loc !== undefined ){
        this.loc = loc;
        if( id.substr(0,loc.length) == loc ){
            id = id.substr(loc.length+1);
        }
    }
    this.id = id;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.TyCon.prototype = new JSHC.Name();
JSHC.TyCon.prototype.toStringN = function(){
    return this.id;
};
JSHC.TyCon.prototype.toStringQ = function(){
    return (this.loc===undefined ? "" : this.loc+".") + this.toStringN();
};
JSHC.TyCon.prototype.toStringV = function(){
    return "type constructor " + this.toStringQ();
};
JSHC.TyCon.prototype.toString = JSHC.TyCon.prototype.toStringN;

////////////////////////////////////////////////////////////////////////////////

JSHC.DaCon = function(id,pos,isSymbol,loc){
    assert.ok( typeof isSymbol === "boolean" );
    this.name = "dacon";
    if( loc !== undefined ){
        this.loc = loc;
        if( id.substr(0,loc.length) == loc ){
            id = id.substr(loc.length+1);
        }
    }
    this.id = id;
    this.isSymbol = isSymbol;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.DaCon.prototype = new JSHC.Name();
JSHC.DaCon.prototype.toStringN = function(){
    return (this.isSymbol ? "("+this.id+")" : this.id);
};
JSHC.DaCon.prototype.toStringQ = function(){
    var qid = this.loc===undefined ? this.id : this.loc+"."+this.id;
    return (this.isSymbol ? "("+qid+")" : qid);
};
JSHC.DaCon.prototype.toStringV = function(){
    return "data constructor " + this.toStringQ();
};
JSHC.DaCon.prototype.toString = JSHC.DaCon.prototype.toStringN;

////////////////////////////////////////////////////////////////////////////////

JSHC.VarName = function(id,pos,isSymbol,loc){
    assert.ok( typeof isSymbol === "boolean" );
    this.name = "varname";
    if( loc !== undefined ){
        this.loc = loc;
        if( id.substr(0,loc.length) == loc ){
            id = id.substr(loc.length+1);
        }
    }
    this.id = id;
    this.isSymbol = isSymbol;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.VarName.prototype = new JSHC.Name();
JSHC.VarName.prototype.toStringN = function(){
    return (this.isSymbol ? "("+this.id+")" : this.id);
};
JSHC.VarName.prototype.toStringQ = function(){
    var qid = this.loc===undefined ? this.id : this.loc+"."+this.id;
    return (this.isSymbol ? "("+qid+")" : qid);
};
JSHC.VarName.prototype.toStringV = function(){
    return "variable " + this.toStringQ();
};
JSHC.VarName.prototype.toString = JSHC.VarName.prototype.toStringN;

////////////////////////////////////////////////////////////////////////////////

JSHC.UnitDaCon = function(pos){
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.UnitDaCon.prototype = new JSHC.DaCon("()",{}, false);

JSHC.NilDaCon = function(pos){
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.NilDaCon.prototype = new JSHC.DaCon("[]",{}, false);

JSHC.ConsDaCon = function(pos){
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.ConsDaCon.prototype = new JSHC.DaCon(":",{}, true);

JSHC.TupleDaCon = function(numberOfParams,pos){
    var id = "(";
    for(var ix=1 ; ix<numberOfParams ; ix++){
        id += ",";
    }
    id += ")";
    this.id = id;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
    this.numberOfParams = numberOfParams;
};
JSHC.TupleDaCon.prototype = new JSHC.DaCon(null, {}, false);

////////////////////////////////////////////////////////////////////////////////

JSHC.TupleTyCon = function(numberOfParams,pos){
    var id = "(";
    for(var ix=1 ; ix<numberOfParams ; ix++){
        id += ",";
    }
    id += ")";
    this.id = id;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
    this.numberOfParams = numberOfParams;
};
JSHC.TupleTyCon.prototype = new JSHC.TyCon(null,{});

////////////////////////////////////////////////////////////////////////////////

JSHC.ConPat = function(con, pats, pos){
    this.name = "conpat";
    
    this.con = con;
    this.pats = pats;
    if( pos !== undefined ){
        this.pos = pos;
    } else {
        this.pos = {};
    }
};
JSHC.ConPat.prototype = new JSHC.Name();
JSHC.ConPat.prototype.toStringN = function(){
    return (this.con.toStringN());
};
JSHC.ConPat.prototype.toStringQ = function(){
    return this.con.toStringQ();
};
JSHC.ConPat.prototype.toStringV = function(){
    return "data constructor " + this.toStringQ();
};
JSHC.ConPat.prototype.toString = JSHC.ConPat.prototype.toStringN;

////////////////////////////////////////////////////////////////////////////////


// --- src/Utility/Types.js ---

////////////////////////////////////////////////////////////////////////////////

/*
  function type
*/
JSHC.FunType = function(types,pos){
    assert.ok( types.length !== undefined );
    assert.ok( types.length > 1 );
    assert.ok( types instanceof Array );
    this.name = "funtype";
    this.types = types;
    if( pos !== undefined ){
       this.pos = pos;
    }
};
JSHC.FunType.prototype.toString = function(){
    var m = ["("];
    for(var i=0 ; i<this.types.length ; i++){
	m.push(this.types[i]);
	m.push(" -> ");
    };
    m.pop();
    m.push(")");
    return m.join("");
};
JSHC.FunType.prototype.toStringQ = JSHC.FunType.prototype.toString;

/*
  application type
*/
JSHC.AppType = function(fun,arg,pos){
    assert.ok( fun !== undefined );
    assert.ok( arg !== undefined );
    this.name = "apptype";
    this.lhs = fun;
    this.rhs = arg;
    if( pos !== undefined ){
       this.pos = pos;
    }
};
JSHC.AppType.prototype.toString = function(){
    return "("+this.lhs+" "+this.rhs+")";
};
JSHC.AppType.prototype.toStringQ = JSHC.AppType.prototype.toString;

/*
  forall type
*/
JSHC.ForallType = function(binds,type){
    this.name = "forall";
    if( binds instanceof Array ){
        this.binds = {};
        for(var ix=0 ; ix<binds.length ; ix++){
            this.binds[binds[ix]] = binds[ix];
        }
    } else {
        this.binds = binds;  // set of bound type variables
    }
    this.type = type;    // the inner type
};
JSHC.ForallType.prototype.toString = function(){
    var m = [];
    m.push("forall");
    for(var tv in this.binds){
	m.push(" ");
	m.push(tv.toString());
    };
    m.push(". ");
    m.push(this.type.toString());
    return m.join("");
};
JSHC.ForallType.prototype.toStringQ = JSHC.ForallType.prototype.toString;

////////////////////////////////////////////////////////////////////////////////


// --- src/Utility/Set.js ---

////////////////////////////////////////////////////////////////////////////////

/*
    param1: optional. stores values if true, else stores null.
    param2: optional. name of show function for keys. defaults to "toString".
*/
JSHC.Set = function(storeValues,opt_toString){
    if( typeof storeValues == "boolean" ){
        this.storeValues = storeValues;
    } else {
        this.storeValues = true;
    }
    if( opt_toString !== undefined ){
        this.toString = opt_toString;
    } else {
        this.toString = "toString";
    }
    this.obj = {};
};

JSHC.Set.prototype.add = function(name){
    this.obj[this.getKey(name)] = this.storeValues ? name : null;
};

/*
  If already in the set, the handler is called with the previous element.
*/
JSHC.Set.prototype.addUnique = function(name,handler){
    var key = this.getKey(name);
    if( this.obj[key] === undefined ){
        this.obj[key] = this.storeValues ? name : null;
    } else {
        if( handler !== undefined ){
            handler(this.obj[key]);
        } else {
            throw new Error("duplicate value");
        }
    }
};

JSHC.Set.prototype.rem = function(name){
    delete this.obj[this.getKey(name)];
};

JSHC.Set.prototype.contains = function(name){
    return this.obj[this.getKey(name)] !== undefined;
};

JSHC.Set.prototype.lookup = function(name){
    assert.ok( this.storeValues === true );
    return this.obj[this.getKey(name)];
};
JSHC.Set.prototype.get = JSHC.Set.prototype.lookup;

JSHC.Set.prototype.getObject = function(){
    return this.obj;
};

JSHC.Set.prototype.getAny = function(){
    for(var k in this.obj){
        return this.obj[k];
    }
};

JSHC.Set.prototype.getKey = function(name){
    return typeof name == "string" ? name : name[this.toString]();
};

JSHC.Set.prototype.getKeys = function(){
    var keys = [];
    for(var k in this.obj){
        keys.push(k);
    }
    return keys;
};

JSHC.Set.prototype.getValues = function(){
    assert.ok( this.storeValues, "no values stored" );
    var values = [];
    for(var k in this.obj){
        values.push(this.obj[k]);
    }
    return values;
};

JSHC.Set.prototype.size = function(){
    return JSHC.numberOfKeys(this.obj);
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Utility/LSpace.js ---

////////////////////////////////////////////////////////////////////////////////

JSHC.LSpace = function(){
    this.sets = [];
};

JSHC.LSpace.prototype.add = function(name){
    this.getCurrent().add(name);
};

JSHC.LSpace.prototype.rem = function(name){
    this.getCurrent().rem(name);
};

JSHC.LSpace.prototype.push = function(){
    this.sets.push(new JSHC.Set(true,"toString"));
};

JSHC.LSpace.prototype.pop = function(){
    assert.ok( this.sets.length > 0 );
    this.sets.pop();
};

JSHC.LSpace.prototype.popEmpty = function(){
    assert.ok( this.sets.length > 0 );
    assert.ok( this.sets[this.sets.length-1].isEmpty() );
    this.sets.pop();
};

JSHC.LSpace.prototype.getAll = function(){
    return this.sets;
};

JSHC.LSpace.prototype.getCurrent = function(){
    assert.ok( this.sets.length > 0 );
    return this.sets[this.sets.length-1];
};

JSHC.LSpace.prototype.contains = function(name){
    return this.lookup(name) !== undefined;
};

/*
    Tries to find the given name in the lspace.
    Returns undefined if not found.
*/
JSHC.LSpace.prototype.lookup = function(name){
    assert.ok( name !== undefined );

    for(var ix=this.sets.length-1 ; ix>=0 ; ix--){
        n = this.sets[ix].lookup(name);
	if( n !== undefined ){
	    return n;
	}
    }
    return undefined;
};

JSHC.LSpace.prototype.withSpace = function(fun){
    this.push();
    fun();
    this.pop();
};

JSHC.LSpace.prototype.toString = function(fun){
    var lists = [];
    for(var ix=this.sets.length-1 ; ix>=0 ; ix--){
        lists.push(this.sets[ix].getKeys());
    }
    return JSHC.showAST(lists);
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Utility/showAST.js ---
// -----------------------------------------------------------------------------
// showing AST

JSHC.showAST = (function(){
	var showAST = function(ast){
	    var sb = [];  // a list as a string buffer/builder
	    try {
	        showAST2(sb,ast);
	    } catch (err) {
	        if( err.message == "too much recursion" && err.name == "InternalError" ){
	            sb.unshift("too much recursion while showing: ");
	        } else {
	            alert(err);
	        }
	    }
	    return sb.join("");
	};

	var showAST2 = function(sb,ast){
	    if( typeof ast === "string" ){
		sb.push("\"" + ast.toString() + "\"");
	    } else if( typeof ast === "number" ){
		sb.push(ast.toString());
	    } else if( typeof ast === "boolean" ){
		sb.push(ast.toString());
	    } else if( ast instanceof Array ){
		sb.push("[");
		sb.push(showNode(sb,ast));
		sb.push("]");
	    } else if( ast instanceof Object ){
		//        if (typeof ast.toString === "function") {
		//            sb.push(ast.toString());
		//        } else {
		sb.push("{");
		var empty = true;
	        for(k in ast){
	            if (typeof ast[k] !== "function") {
	                sb.push(k+": ");
	                //if( k==="rhs" )document.write("yy"+ast[k] +"<br>");
	                showAST2(sb,ast[k]);
	                //document.write(s +"<br>");
	                sb.push(", ");
	                empty = false;
	            } 
	        }
	        if( !empty )sb.pop();
	        sb.push("}");
		//	    }
	    } else if( ast === null ){ // typeof null === "object"
	        sb.push("null");
	    } else if( ast === undefined){
	        sb.push("undefined");
	    } else {
		throw new Error("unhandled case: "+typeof ast);
	    }
	    //return "(" + typeof ast + ast.toString() + ")";
	};

	var showNode = function(sb,l){
	    if ( l.length == 0 ) {
		return;
	    }
	    //document.write(s +"<br>");
	    showNodeNE(sb,l);
	};
	
	var showNodeNE = function(sb,l){
	    for(var i=0 ; i<l.length-1 ; i=i+1){
		showAST2(sb,l[i]);
		sb.push(", ");
	    }
	    //document.write(s +"<br>");
	    showAST2(sb,l[l.length-1]);
	}

	return showAST;
    })();

// -----------------------------------------------------------------------------


// --- src/Internal/Internal.js ---

if( ! JSHC.Internal )JSHC.Internal = new Object();
if( ! JSHC.Internal.Prelude )JSHC.Internal.Prelude = new Object();
if( ! JSHC.Internal.Types )JSHC.Internal.Types = new Object();
// primtive operations for use in the Prelude.

////////////////////////////////////////////////////////////////////////////////

/*
    the optional name is the name used in as-patterns
*/
JSHC.Internal.WildPat = function(varname){
    assert.ok(typeof varname == "string" || varname === undefined);
    this.varname = varname;
    this.name = "WildPat";
    this.toString = function() {
    	return "_";
    };
};

JSHC.Internal.IntegerPat = function(number){
    assert.ok(typeof number == "number" );
    this.number = number;
    this.name = "IntegerPat";
    this.toString = function () {
    	return this.number;
    }
};

JSHC.Internal.NamePat = function(varname){
    assert.ok(typeof varname == "string");
    this.varname = varname;
    this.name = "NamePat";
    this.toString = function () {
   		return this.varname;
    };
};

JSHC.Internal.ConPat = function(dacon,args){
    assert.ok(typeof dacon == "string");
    assert.ok(args instanceof Array);
    this.dacon = dacon;
    this.args = args;
    this.name = "ConPat";
    this.toString = function () {
    	return this.dacon + " " + this.args.join(" ");
    };
};

JSHC.Internal.TuplePat = function(args){
    assert.ok(args instanceof Array);
    this.args = args;
    this.name = "TuplePat";
    this.toString = function () {
    	return "(" + args + ")";
    }
};

JSHC.Internal.undefined = function() {
    throw new JSHC.RuntimeError("undefined");
};

JSHC.Internal.int32maxbound = Math.pow(2,31)-1;
JSHC.Internal.int32minbound = -Math.pow(2,31);
JSHC.Internal.int16maxbound = Math.pow(2,15)-1;
JSHC.Internal.int16minbound = -Math.pow(2,15);
JSHC.Internal.int8maxbound = Math.pow(2,7)-1;
JSHC.Internal.int8minbound = -Math.pow(2,7);

// :: Int32 -> Int32 -> Int32
JSHC.Internal.int32add = function(a,b){
    var r = a + b;
    if( r > JSHC.Internal.int32maxbound || r < JSHC.Internal.int32minbound )throw new JSHC.RuntimeError("Data.Int.Int32 out of bounds in "+a+" + "+b);
    return r;
};

// :: Int32 -> Int32 -> Int32
JSHC.Internal.int32sub = function(a,b){
    var r = a - b;
    if( r > JSHC.Internal.int32maxbound || r < JSHC.Internal.int32minbound )throw new JSHC.RuntimeError("Data.Int.Int32 out of bounds in "+a+" - "+b);
    return r;
};

// :: Int32 -> Int32 -> Int32
JSHC.Internal.int32mul = function(a,b){
    var r = a * b;
    if( r > JSHC.Internal.int32maxbound || r < JSHC.Internal.int32minbound )throw new JSHC.RuntimeError("Data.Int.Int32 out of bounds in "+a+" * "+b);
    return r;
};

// :: Int32 -> Int32 -> Int32
JSHC.Internal.int32div = function(a,b){
    if( b == 0 ){
        throw new JSHC.RuntimeError("Data.Int.Int32 division by 0 in "+a+" / "+b);
    }
    var r = Math.floor(a / b);
    assert.ok(r >= JSHC.Internal.int32minbound);
    // NOTE: minbound/-1 will be out of bounds since > maxbound.
    if( r > JSHC.Internal.int32maxbound )throw new JSHC.RuntimeError("Data.Int.Int32 out of bounds in "+a+" / "+b);
    return r;
};

// :: Int32 -> Int32 -> Int32
JSHC.Internal.int32max = function(a,b){
    return Math.max(a,b);
};

JSHC.Internal.int32min = function(a,b){
    return Math.min(a,b);
};

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32eq = function(a,b){
    return a===b;
};

// :: Int32 -> Int32
JSHC.Internal.int32negate = function (a) {
    return 0 - a;
};

// :: Int32 -> Int32
JSHC.Internal.int32abs = function (a) {
    return Math.abs(a);
};

// :: Int32 -> Int32
JSHC.Internal.int32signum = function (a) {
    if( a > 0 )return 1;
    if( a < 0 )return -1;
    return 0;
};

//JSHC.Internal.int32show = function(a){
//    return new String(a);
//}

// :: String -> Int32
//JSHC.Internal.int32read = function(s){
//    return new Number(s);
//    // TOOD: must give some reasonable exception when not a number.
//}

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32lt = function (a,b) {
    return a < b;
};

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32gt = function (a,b) {
    return a > b;
};

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32le = function (a,b) {
    return a <= b;
};

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32ge = function (a,b) {
    return a >= b;
};

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32eq = function (a,b) {
    return a == b;
};

// :: Int32 -> Int32 -> Bool
JSHC.Internal.int32ne = function (a,b) {
    return a != b;
};

//JSHC.Internal.int32comp = function(fun) {
//    return (function(a) {
//    return function (b) {
//        if ( fun( (a instanceof JSHC.Thunk)? a.v : a , (b instanceof JSHC.Thunk)? b.v : b ) ) {
//            return ["True"];
//        } else {
//            return ["False"];
//        }
//    }} );
//}

JSHC.Internal.seq = function (a,b) {
    return b;
};

/*
  converts [Char] to a JavaScript String.
*/
JSHC.Internal.HSString_to_JSString = function(list){
  str="";
  var node = list.v;
  while( node.dacon !== "[]" ){
    assert.ok( node.dacon == ":" );
    assert.ok( typeof node.args[0].v == "string" );
    str += node.args[0].v;
    node = node.args[1].v;
  };
  return str;
};

////////////////////////////////////////////////////////////////////////////////

//match evaluated exp against pat
//returns: an array with any bound variables if successful, Boolean false if failed
JSHC.Internal.match = function(exp, alts) {
//    alert("match called with exp:\n\n" + JSHC.showAST(exp) + "\n\nand alts\n\n" + JSHC.showAST(alts))

    if( !(exp instanceof JSHC.Thunk) ){
        exp = new JSHC.Thunk(exp);
    }

    // array of thunks from the matching expressions
    var binds;

//    JSHC.alert("matching:", exp, "\nto:", alts);

    var match_ = function (exp, pat) {    
//    JSHC.alert("checking exp:", exp, "\nagainst pat:", pat);
        //JSHC.alert("match: before switch:\n",pat.name,"\n",pat);
        switch (pat.name) {
            case "NamePat":
                //JSHC.alert("match in case: namepat");
                binds.push(exp);
                return true;

            case "IntegerPat":
                //JSHC.alert("match in case: integer");
                return exp.v === pat.number;

            case "WildPat":
                //JSHC.alert("match in case: wildcard");
                return true;

            //case "dacon":
            //    return (pat.p[0] === exp[0] && pat.p.length === exp.length);

            case "ConPat":
                //JSHC.alert("match: conpat: evaluating the thunk");
                exp = exp.v;
                assert.ok( !( exp instanceof JSHC.Thunk) );
                
                //JSHC.alert("match conpat\n",exp);
                //if( exp.dacon == ":" ){
                //    JSHC.alert("match conpat2\n",exp.args);
                //}

                var res = exp instanceof JSHC.Internal.Datatype;
                if( res === false ){
                    //JSHC.alert("no match");
                    return res;
                }
                res = pat.dacon == exp.dacon && pat.args.length === exp.args.length;

                for (var i = 0; i < pat.args.length; i++) {
                    //if (exp[i] instanceof JSHC.Thunk)
                        res = res && match_(exp.args[i],pat.args[i]);
                    //else
                    //    res = res && match_(exp[i],pat.p[i]);
                }
                //if( res == false )JSHC.alert("no match");
                return res;

            case "TuplePat":
                exp = exp.v;
                assert.ok( !( exp instanceof JSHC.Thunk) );

                //JSHC.alert("match tuppat\n",exp);
                //if( exp.dacon == ":" ){
                //    JSHC.alert("match tuppat2\n",exp.args);
                //}

                var res = exp instanceof JSHC.Internal.Types["()"];
                if( res === false ){
                    //JSHC.alert("no match");
                    return res;
                }
                res = pat.args.length === exp.args.length;

                for (var i = 0; i < pat.args.length; i++) {
                    //if (exp[i] instanceof JSHC.Thunk)
                        res = res && match_(exp.args[i],pat.args[i]);
                    //else
                    //    res = res && match_(exp[i],pat.p[i]);
                }
                //if( res == false )JSHC.alert("no match");
                return res;

            default: 
                throw new JSHC.RuntimeError("match_ needs definition for: " + pat.name);
        }
    }
//try{
    for (var i = 0; i < alts.length; i++) {
        binds = [];
        if (match_(exp, alts[i].p)) {
            assert.ok(alts[i].f instanceof Function, "rhs of pattern is not a function!");
//            alert("matched something: " + alts[i].f);
//            alert("with binds: " + binds);
            //document.write(alts[i].f);
            //JSHC.alert(binds[0]);
            //JSHC.alert(binds[1]);
            //JSHC.alert(binds[2].v);
            //JSHC.alert(typeof binds[0],typeof binds[1],typeof binds[2]);
            var f_result = alts[i].f.apply(undefined,binds);
            //JSHC.alert("got f result");
            //JSHC.alert(f_result);
            return f_result;
        }
    }
//}catch(err){JSHC.alert("unexpected error in match\n",err);}
   var errPats = "[";
   for (var i = 0; i < alts.length; i++) {
   		errPats += alts[i].p.toString();
   		errPats += " or ";
   }
   errPats = errPats.substring(0, errPats.length-4) + "]";
   // throw new Error("Unhandled case in pattern match! " + JSHC.showAST(exp) + " alts:\n\n" + JSHC.showAST(alts)); //TODO: proper error reporting would be?
   throw new JSHC.RuntimeError("Unhandled case in pattern match: matching " + exp.v + " against alternatives: " + errPats);  
}

////////////////////////////////////////////////////////////////////////////////

/*
  Arbitrary datatype
*/
JSHC.Internal.Datatype = function(){
};

/*
   default instance of Show for data types
*/
JSHC.Internal.Datatype.prototype.toString = function(){
    var buf = [];
    buf.push(this.dacon.toString());
    buf.push(" ");
    for(var i=0 ; i<this.args.length ; i++){
        buf.push("(");
        buf.push(this.args[i].toString());
        buf.push(")");
        buf.push(" ");
    }
    buf.pop();   // remove last space
    return buf.join("");
};

/*
  List datatype
*/
JSHC.Internal.Types["[]"] = function(dacon,args){
    assert.ok(typeof dacon == "string");
    assert.ok(args instanceof Array);
    this.dacon = dacon;
    this.args = args;
};
JSHC.Internal.Types["[]"].prototype = new JSHC.Internal.Datatype();

/*
  List toString
*/
JSHC.Internal.Types["[]"].prototype.toString = function(){
    var buf = [];
    buf.push("[");
    if( this.dacon == ":" ){
        buf.push(this.args[0].toString());
        var rest = this.args[1].v;  // evaluate the rest
        while(true){
            if( rest.dacon == "[]" ){
                break;
            }
            assert.ok( rest.dacon == ":" );
            buf.push(",");
            buf.push(rest.args[0].toString());
            rest = rest.args[1].v;  // evaluate the rest
        }
    } else if( this.dacon == "[]" ){
        // do nothing
    } else {
        throw new JSHC.RuntimeError("invalid dacon in List toString");
    }
    buf.push("]");
    return buf.join("");
};

/*
  List Cons constructor
*/
JSHC.Internal.Types["[].:"] = function(a){
    return new JSHC.Thunk(function(b){
        assert.ok( a instanceof JSHC.Thunk );
        assert.ok( b instanceof JSHC.Thunk );
        //JSHC.alert("cons:\n",a,"\n",b);
        return new JSHC.Thunk(new JSHC.Internal.Types["[]"](":",[a,b]));
    });
};

/*
  List Nil constructor
*/
JSHC.Internal.Types["[].[]"] = function(){
    return new JSHC.Internal.Types["[]"]("[]",[]);
}();

/*
  Unit/Tuple datatypes
*/
JSHC.Internal.Types["()"] = function(args){
    assert.ok(args instanceof Array);
    this.args = args;
};
JSHC.Internal.Types["()"].prototype = new JSHC.Internal.Datatype();

/*
  Unit/Tuple toString
*/
JSHC.Internal.Types["()"].prototype.toString = function(){
    var buf = [];
    buf.push("(");
    for(var i=0 ; i<this.args.length ; i++){
        buf.push(this.args[i].toString());
        buf.push(",");
    }
    buf.pop();   // remove last space
    buf.push(")");
    return buf.join("");
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Internal/lazy.js ---

// -----------------------------------------------------------------------------
// lazy evaluation

JSHC.Thunk = function (exp) {
    //assert.ok( ! (exp instanceof JSHC.Thunk) );
    this.v = exp
}

JSHC.Thunk.prototype = {
    get v(){
            
        if (this._v instanceof Function && this._v.length === 0) {
            this.v = this._v();
        }
        if( this._v instanceof JSHC.Thunk ) {
            this.v = this._v.v;
        }
        
        //if (this._v instanceof JSHC.Thunk) {
        //    this.v = this._v.v;
        //}
        
        assert.ok( !(this._v instanceof JSHC.Thunk) );
        return this._v;
    },
    set v(val){
        this._v = val;
    }
};
JSHC.Thunk.prototype.toString = function() {
    return this.v.toString();
};

/*
// TODO: need to have a way to handle functions of arbitrary arity.
function thunk_computation_a1(f){
  return function(thunk){
    var result = f(JSHC.TR(thunk.a[0]));
    delete thunk.as;
    return result;
  }
}
function thunk_computation_a2(f){
  return function(thunk){
    var result = f(JSHC.TR(thunk.as[0]),JSHC.TR(thunk.as[1]));
    delete thunk.as;
    return result;
  }
}
function thunk_computation_a3(f){
  return function(thunk){
    var result = f(JSHC.TR(thunk.a1),JSHC.TR(thunk.a2),JSHC.TR(thunk.a3));
    delete thunk.a1;
    delete thunk.a2;
    delete thunk.a3;
    return result;
  }
}
JSHC.TC1 = thunk_computation_a1
JSHC.TC2 = thunk_computation_a2
JSHC.TC3 = thunk_computation_a3
*/

// create and see if thunks work correctly.
//function test_thunk(){
//  // create thunk for "1 + 2"
//  var args = [JSHC.TS(1),JSHC.TS(2)]
//  var f = function(a){return JSHC.TR(a[0])+JSHC.TR(a[1])}
//  var t = JSHC.TC(f,args);

//  // must only contain the computation and arguments before being evaluated
//  JSHC.assert(getKeys(t) == "c,as", "not 'c' and 'as' in thunk");

//  var result = JSHC.TR(t)
//  JSHC.assert(result === 3, "not correct result. got: "+result);

//  // must only contain the value after being evaluated
//  JSHC.assert(getKeys(t) == "v", "not 'v' in thunk");
//}
//test_thunk();


// --- src/Internal/prelude.js ---
//require Internal/Internal.js


// a fake prelude written directly in javascript

/* the original haskell source could have looked like:

(+) = JSHC.int32add
(-) = JSHC.int32sub
(*) = JSHC.int32mul
(/) = JSHC.int32div

*/

/*
if (JSHC.Internal === undefined)
        JSHC.Internal = {};

JSHC.Internal.PreludeXXXXXXXXX = {
  // makes thunk computations of javascript operations.
//  "+": function(a,b){return JSHC.int32add(JSHC.TR(a),JSHC.TR(b))},
//  "-": function(a,b){return JSHC.int32sub(JSHC.TR(a),JSHC.TR(b))},
//  "*": function(a,b){return JSHC.int32mul(JSHC.TR(a),JSHC.TR(b))},
//  "/": function(a,b){return JSHC.int32div(JSHC.TR(a),JSHC.TR(b))},
  int32add: function(a) {
    return function (b) {
        return JSHC.int32add((a instanceof JSHC.Thunk)? a.v : a,(b instanceof JSHC.Thunk)? b.v : b)
        }},
  int32sub: function(a) {
    return function (b) {
        return JSHC.int32sub((a instanceof JSHC.Thunk)? a.v : a,(b instanceof JSHC.Thunk)? b.v : b)
        }},
  int32mul: function(a) {
    return function (b) {
        return JSHC.int32mul((a instanceof JSHC.Thunk)? a.v : a,(b instanceof JSHC.Thunk)? b.v : b)
        }},
  int32div: function(a) {
    return function (b) {
        return JSHC.int32div((a instanceof JSHC.Thunk)? a.v : a,(b instanceof JSHC.Thunk)? b.v : b)
        }},

  int32lt: JSHC.int32comp(JSHC.int32lt),
  int32gt: JSHC.int32comp(JSHC.int32gt),
  int32le: JSHC.int32comp(JSHC.int32le),
  int32ge: JSHC.int32comp(JSHC.int32ge),
  int32eq: JSHC.int32comp(JSHC.int32eq),
  int32ne: JSHC.int32comp(JSHC.int32ne),
 }
*/

/*
JSHC.Internal.Prelude["undefined"] = JSHC.TC(function() {throw new JSHC.RuntimeError("undefined")});
*/


// --- src/Parser/Lexeme.js ---
function Token (v, r, c, t) {
    this.val = v;
    this.row = r;
    this.col = c;
    this.typ = t;
    
    this.toString = function() {
        var q = (this.qual !== undefined)? this.qual : "undefined"; 
        return ("[ val: " + this.val + ", row: " + this.row + ", col: " + this.col + ", typ: " + this.typ + ", qual: " + q + "]");
    }
}

function Ind (c, r, b) {
    this.col = c;
    this.row = r;
    this.isBlock = b;
    this.toString = function() {
        if (b)
            return ("{" + this.col + "}");
        else
            return ("<" + this.col + ">");
    }
}

//constant functions for readability
function BLOCKIND() {return true;}
function ROWIND() {return false;}


// --- src/Parser/tokenize.js ---
JSHC.Parser.tokenize = (function(){
  /* Generated by PEG.js 0.6.1 (http://pegjs.majda.cz/). */
  
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      var parseFunctions = {
        "ANY": parse_ANY,
        "ANYseq": parse_ANYseq,
        "any": parse_any,
        "ascDigit": parse_ascDigit,
        "ascLarge": parse_ascLarge,
        "ascSmall": parse_ascSmall,
        "ascSymbol": parse_ascSymbol,
        "ascii": parse_ascii,
        "char": parse_char,
        "charesc": parse_charesc,
        "closecom": parse_closecom,
        "cntrl": parse_cntrl,
        "comment": parse_comment,
        "conid": parse_conid,
        "conid_e": parse_conid_e,
        "consym": parse_consym,
        "consym_e": parse_consym_e,
        "dashes": parse_dashes,
        "decimal": parse_decimal,
        "escape": parse_escape,
        "escapestuff": parse_escapestuff,
        "exponent": parse_exponent,
        "float": parse_float,
        "formfeed": parse_formfeed,
        "gap": parse_gap,
        "graphic": parse_graphic,
        "hexadecimal": parse_hexadecimal,
        "hexit": parse_hexit,
        "integer": parse_integer,
        "lexeme": parse_lexeme,
        "linefeed": parse_linefeed,
        "literal": parse_literal,
        "ncomment": parse_ncomment,
        "newline": parse_newline,
        "notdecimal": parse_notdecimal,
        "octal": parse_octal,
        "octit": parse_octit,
        "opencom": parse_opencom,
        "qconid": parse_qconid,
        "qconsym": parse_qconsym,
        "qvarid": parse_qvarid,
        "qvarsym": parse_qvarsym,
        "reservedid": parse_reservedid,
        "reservedop": parse_reservedop,
        "return": parse_return,
        "small": parse_small,
        "space": parse_space,
        "special": parse_special,
        "start": parse_start,
        "string": parse_string,
        "stringchar": parse_stringchar,
        "symbol": parse_symbol,
        "tab": parse_tab,
        "varid": parse_varid,
        "varid_e": parse_varid_e,
        "varsym": parse_varsym,
        "varsym_e": parse_varsym_e,
        "vertab": parse_vertab,
        "whitechar": parse_whitechar,
        "whitespace": parse_whitespace,
        "whitestuff": parse_whitestuff
      };
      
      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "start";
      }
      
      var pos = 0;
      var reportMatchFailures = true;
      var rightmostMatchFailuresPos = 0;
      var rightmostMatchFailuresExpected = [];
      var cache = {};
      
      function padLeft(input, padding, length) {
        var result = input;
        
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
        
        return result;
      }
      
      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        
        if (charCode <= 0xFF) {
          var escapeChar = 'x';
          var length = 2;
        } else {
          var escapeChar = 'u';
          var length = 4;
        }
        
        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }
      
      function quote(s) {
        /*
         * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
         * string literal except for the closing quote character, backslash,
         * carriage return, line separator, paragraph separator, and line feed.
         * Any character may appear in the form of an escape sequence.
         */
        return '"' + s
          .replace(/\\/g, '\\\\')            // backslash
          .replace(/"/g, '\\"')              // closing quote character
          .replace(/\r/g, '\\r')             // carriage return
          .replace(/\n/g, '\\n')             // line feed
          .replace(/[\x80-\uFFFF]/g, escape) // non-ASCII characters
          + '"';
      }
      
      function matchFailed(failure) {
        if (pos < rightmostMatchFailuresPos) {
          return;
        }
        
        if (pos > rightmostMatchFailuresPos) {
          rightmostMatchFailuresPos = pos;
          rightmostMatchFailuresExpected = [];
        }
        
        rightmostMatchFailuresExpected.push(failure);
      }
      
      function parse_start() {
        var cacheKey = 'start@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result3 = parse_whitespace();
        if (result3 !== null) {
          var result1 = result3;
        } else {
          var result2 = parse_lexeme();
          if (result2 !== null) {
            var result1 = result2;
          } else {
            var result1 = null;;
          };
        }
        if (result1 !== null) {
          var result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            var result3 = parse_whitespace();
            if (result3 !== null) {
              var result1 = result3;
            } else {
              var result2 = parse_lexeme();
              if (result2 !== null) {
                var result1 = result2;
              } else {
                var result1 = null;;
              };
            }
          }
        } else {
          var result0 = null;
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_lexeme() {
        var cacheKey = 'lexeme@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result12 = parse_varid_e();
        if (result12 !== null) {
          var result0 = result12;
        } else {
          var result11 = parse_conid_e();
          if (result11 !== null) {
            var result0 = result11;
          } else {
            var result10 = parse_varsym_e();
            if (result10 !== null) {
              var result0 = result10;
            } else {
              var result9 = parse_consym_e();
              if (result9 !== null) {
                var result0 = result9;
              } else {
                var result8 = parse_qvarid();
                if (result8 !== null) {
                  var result0 = result8;
                } else {
                  var result7 = parse_qconid();
                  if (result7 !== null) {
                    var result0 = result7;
                  } else {
                    var result6 = parse_qvarsym();
                    if (result6 !== null) {
                      var result0 = result6;
                    } else {
                      var result5 = parse_qconsym();
                      if (result5 !== null) {
                        var result0 = result5;
                      } else {
                        var result4 = parse_literal();
                        if (result4 !== null) {
                          var result0 = result4;
                        } else {
                          var result3 = parse_special();
                          if (result3 !== null) {
                            var result0 = result3;
                          } else {
                            var result2 = parse_reservedop();
                            if (result2 !== null) {
                              var result0 = result2;
                            } else {
                              var result1 = parse_reservedid();
                              if (result1 !== null) {
                                var result0 = result1;
                              } else {
                                var result0 = null;;
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_literal() {
        var cacheKey = 'literal@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result4 = parse_integer();
        if (result4 !== null) {
          var result0 = result4;
        } else {
          var result3 = parse_float();
          if (result3 !== null) {
            var result0 = result3;
          } else {
            var result2 = parse_char();
            if (result2 !== null) {
              var result0 = result2;
            } else {
              var result1 = parse_string();
              if (result1 !== null) {
                var result0 = result1;
              } else {
                var result0 = null;;
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_special() {
        var cacheKey = 'special@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "(") {
          var result10 = "(";
          pos += 1;
        } else {
          var result10 = null;
          if (reportMatchFailures) {
            matchFailed("\"(\"");
          }
        }
        if (result10 !== null) {
          var result1 = result10;
        } else {
          if (input.substr(pos, 1) === ")") {
            var result9 = ")";
            pos += 1;
          } else {
            var result9 = null;
            if (reportMatchFailures) {
              matchFailed("\")\"");
            }
          }
          if (result9 !== null) {
            var result1 = result9;
          } else {
            if (input.substr(pos, 1) === ",") {
              var result8 = ",";
              pos += 1;
            } else {
              var result8 = null;
              if (reportMatchFailures) {
                matchFailed("\",\"");
              }
            }
            if (result8 !== null) {
              var result1 = result8;
            } else {
              if (input.substr(pos, 1) === ";") {
                var result7 = ";";
                pos += 1;
              } else {
                var result7 = null;
                if (reportMatchFailures) {
                  matchFailed("\";\"");
                }
              }
              if (result7 !== null) {
                var result1 = result7;
              } else {
                if (input.substr(pos, 1) === "[") {
                  var result6 = "[";
                  pos += 1;
                } else {
                  var result6 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"[\"");
                  }
                }
                if (result6 !== null) {
                  var result1 = result6;
                } else {
                  if (input.substr(pos, 1) === "]") {
                    var result5 = "]";
                    pos += 1;
                  } else {
                    var result5 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"]\"");
                    }
                  }
                  if (result5 !== null) {
                    var result1 = result5;
                  } else {
                    if (input.substr(pos, 1) === "`") {
                      var result4 = "`";
                      pos += 1;
                    } else {
                      var result4 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"`\"");
                      }
                    }
                    if (result4 !== null) {
                      var result1 = result4;
                    } else {
                      if (input.substr(pos, 1) === "{") {
                        var result3 = "{";
                        pos += 1;
                      } else {
                        var result3 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"{\"");
                        }
                      }
                      if (result3 !== null) {
                        var result1 = result3;
                      } else {
                        if (input.substr(pos, 1) === "}") {
                          var result2 = "}";
                          pos += 1;
                        } else {
                          var result2 = null;
                          if (reportMatchFailures) {
                            matchFailed("\"}\"");
                          }
                        }
                        if (result2 !== null) {
                          var result1 = result2;
                        } else {
                          var result1 = null;;
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }
        var result0 = result1 !== null
          ? (function(s) {return {val: s, typ: s}})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_whitespace() {
        var cacheKey = 'whitespace@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result2 = parse_whitestuff();
        if (result2 !== null) {
          var result1 = [];
          while (result2 !== null) {
            result1.push(result2);
            var result2 = parse_whitestuff();
          }
        } else {
          var result1 = null;
        }
        var result0 = result1 !== null
          ? (function(w) {return {val: w.join("")}})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_whitestuff() {
        var cacheKey = 'whitestuff@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result3 = parse_whitechar();
        if (result3 !== null) {
          var result0 = result3;
        } else {
          var result2 = parse_comment();
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result1 = parse_ncomment();
            if (result1 !== null) {
              var result0 = result1;
            } else {
              var result0 = null;;
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_whitechar() {
        var cacheKey = 'whitechar@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result4 = parse_newline();
        if (result4 !== null) {
          var result0 = result4;
        } else {
          var result3 = parse_vertab();
          if (result3 !== null) {
            var result0 = result3;
          } else {
            var result2 = parse_space();
            if (result2 !== null) {
              var result0 = result2;
            } else {
              var result1 = parse_tab();
              if (result1 !== null) {
                var result0 = result1;
              } else {
                var result0 = null;;
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_newline() {
        var cacheKey = 'newline@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var result4 = parse_return();
        if (result4 !== null) {
          var result5 = parse_linefeed();
          if (result5 !== null) {
            var result3 = [result4, result5];
          } else {
            var result3 = null;
            pos = savedPos0;
          }
        } else {
          var result3 = null;
          pos = savedPos0;
        }
        if (result3 !== null) {
          var result0 = result3;
        } else {
          var result2 = parse_linefeed();
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result1 = parse_formfeed();
            if (result1 !== null) {
              var result0 = result1;
            } else {
              var result0 = null;;
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_return() {
        var cacheKey = 'return@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "\r") {
          var result0 = "\r";
          pos += 1;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"\\r\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_linefeed() {
        var cacheKey = 'linefeed@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "\n") {
          var result0 = "\n";
          pos += 1;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"\\n\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_vertab() {
        var cacheKey = 'vertab@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "") {
          var result0 = "";
          pos += 1;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_formfeed() {
        var cacheKey = 'formfeed@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "") {
          var result0 = "";
          pos += 1;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_space() {
        var cacheKey = 'space@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === " ") {
          var result0 = " ";
          pos += 1;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\" \"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_tab() {
        var cacheKey = 'tab@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "	") {
          var result0 = "	";
          pos += 1;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"	\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_comment() {
        var cacheKey = 'comment@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var result2 = parse_dashes();
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedPos2 = pos;
          var savedPos3 = pos;
          var savedReportMatchFailuresVar0 = reportMatchFailures;
          reportMatchFailures = false;
          var result11 = parse_symbol();
          reportMatchFailures = savedReportMatchFailuresVar0;
          if (result11 === null) {
            var result9 = '';
          } else {
            var result9 = null;
            pos = savedPos3;
          }
          if (result9 !== null) {
            var result10 = parse_any();
            if (result10 !== null) {
              var result6 = [result9, result10];
            } else {
              var result6 = null;
              pos = savedPos2;
            }
          } else {
            var result6 = null;
            pos = savedPos2;
          }
          if (result6 !== null) {
            var result7 = [];
            var result8 = parse_any();
            while (result8 !== null) {
              result7.push(result8);
              var result8 = parse_any();
            }
            if (result7 !== null) {
              var result5 = [result6, result7];
            } else {
              var result5 = null;
              pos = savedPos1;
            }
          } else {
            var result5 = null;
            pos = savedPos1;
          }
          var result3 = result5 !== null ? result5 : '';
          if (result3 !== null) {
            var result4 = parse_newline();
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(ds, n) {return n})(result1[0], result1[2])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_dashes() {
        var cacheKey = 'dashes@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "-") {
          var result2 = "-";
          pos += 1;
        } else {
          var result2 = null;
          if (reportMatchFailures) {
            matchFailed("\"-\"");
          }
        }
        if (result2 !== null) {
          if (input.substr(pos, 1) === "-") {
            var result4 = "-";
            pos += 1;
          } else {
            var result4 = null;
            if (reportMatchFailures) {
              matchFailed("\"-\"");
            }
          }
          if (result4 !== null) {
            var result3 = [];
            while (result4 !== null) {
              result3.push(result4);
              if (input.substr(pos, 1) === "-") {
                var result4 = "-";
                pos += 1;
              } else {
                var result4 = null;
                if (reportMatchFailures) {
                  matchFailed("\"-\"");
                }
              }
            }
          } else {
            var result3 = null;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(d, ds) {return d.concat(ds.join(""))})(result1[0], result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_opencom() {
        var cacheKey = 'opencom@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 2) === "{-") {
          var result0 = "{-";
          pos += 2;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"{-\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_closecom() {
        var cacheKey = 'closecom@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 2) === "-}") {
          var result0 = "-}";
          pos += 2;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("\"-}\"");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ncomment() {
        var cacheKey = 'ncomment@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos3 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        var result11 = parse_symbol();
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result11 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos3;
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var result4 = parse_opencom();
          if (result4 !== null) {
            var result5 = parse_ANYseq();
            if (result5 !== null) {
              var result6 = [];
              var savedPos2 = pos;
              var result9 = parse_ncomment();
              if (result9 !== null) {
                var result10 = parse_ANYseq();
                if (result10 !== null) {
                  var result8 = [result9, result10];
                } else {
                  var result8 = null;
                  pos = savedPos2;
                }
              } else {
                var result8 = null;
                pos = savedPos2;
              }
              while (result8 !== null) {
                result6.push(result8);
                var savedPos2 = pos;
                var result9 = parse_ncomment();
                if (result9 !== null) {
                  var result10 = parse_ANYseq();
                  if (result10 !== null) {
                    var result8 = [result9, result10];
                  } else {
                    var result8 = null;
                    pos = savedPos2;
                  }
                } else {
                  var result8 = null;
                  pos = savedPos2;
                }
              }
              if (result6 !== null) {
                var result7 = parse_closecom();
                if (result7 !== null) {
                  var result3 = [result4, result5, result6, result7];
                } else {
                  var result3 = null;
                  pos = savedPos1;
                }
              } else {
                var result3 = null;
                pos = savedPos1;
              }
            } else {
              var result3 = null;
              pos = savedPos1;
            }
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(com) {return flatten(com).join("").replace(/\S/g," ");})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ANYseq() {
        var cacheKey = 'ANYseq@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result1 = [];
        var result2 = parse_ANY();
        while (result2 !== null) {
          result1.push(result2);
          var result2 = parse_ANY();
        }
        var result0 = result1 !== null
          ? (function(as) {return as.join("")})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ANY() {
        var cacheKey = 'ANY@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos1 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        var result8 = parse_opencom();
        if (result8 !== null) {
          var result6 = result8;
        } else {
          var result7 = parse_closecom();
          if (result7 !== null) {
            var result6 = result7;
          } else {
            var result6 = null;;
          };
        }
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result6 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos1;
        }
        if (result2 !== null) {
          var result5 = parse_graphic();
          if (result5 !== null) {
            var result3 = result5;
          } else {
            var result4 = parse_whitechar();
            if (result4 !== null) {
              var result3 = result4;
            } else {
              var result3 = null;;
            };
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(a) {return a})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_any() {
        var cacheKey = 'any@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result3 = parse_graphic();
        if (result3 !== null) {
          var result0 = result3;
        } else {
          var result2 = parse_space();
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result1 = parse_tab();
            if (result1 !== null) {
              var result0 = result1;
            } else {
              var result0 = null;;
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_graphic() {
        var cacheKey = 'graphic@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result8 = parse_small();
        if (result8 !== null) {
          var result1 = result8;
        } else {
          var result7 = parse_ascLarge();
          if (result7 !== null) {
            var result1 = result7;
          } else {
            var result6 = parse_symbol();
            if (result6 !== null) {
              var result1 = result6;
            } else {
              var result5 = parse_ascDigit();
              if (result5 !== null) {
                var result1 = result5;
              } else {
                var result4 = parse_special();
                if (result4 !== null) {
                  var result1 = result4;
                } else {
                  if (input.substr(pos, 1) === "\"") {
                    var result3 = "\"";
                    pos += 1;
                  } else {
                    var result3 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"\\\"\"");
                    }
                  }
                  if (result3 !== null) {
                    var result1 = result3;
                  } else {
                    if (input.substr(pos, 1) === "'") {
                      var result2 = "'";
                      pos += 1;
                    } else {
                      var result2 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"'\"");
                      }
                    }
                    if (result2 !== null) {
                      var result1 = result2;
                    } else {
                      var result1 = null;;
                    };
                  };
                };
              };
            };
          };
        }
        var result0 = result1 !== null
          ? (function(g) {return (g instanceof Object? g.val:g)})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_small() {
        var cacheKey = 'small@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result2 = parse_ascSmall();
        if (result2 !== null) {
          var result0 = result2;
        } else {
          if (input.substr(pos, 1) === "_") {
            var result1 = "_";
            pos += 1;
          } else {
            var result1 = null;
            if (reportMatchFailures) {
              matchFailed("\"_\"");
            }
          }
          if (result1 !== null) {
            var result0 = result1;
          } else {
            var result0 = null;;
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ascSmall() {
        var cacheKey = 'ascSmall@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos).match(/^[a-z]/) !== null) {
          var result0 = input.charAt(pos);
          pos++;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("[a-z]");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ascLarge() {
        var cacheKey = 'ascLarge@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos).match(/^[A-Z]/) !== null) {
          var result0 = input.charAt(pos);
          pos++;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("[A-Z]");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_symbol() {
        var cacheKey = 'symbol@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result1 = parse_ascSymbol();
        var result0 = result1 !== null
          ? (function(s) {return s})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ascSymbol() {
        var cacheKey = 'ascSymbol@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos1 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        var result26 = parse_opencom();
        if (result26 !== null) {
          var result24 = result26;
        } else {
          var result25 = parse_closecom();
          if (result25 !== null) {
            var result24 = result25;
          } else {
            var result24 = null;;
          };
        }
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result24 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos1;
        }
        if (result2 !== null) {
          if (input.substr(pos, 1) === "!") {
            var result23 = "!";
            pos += 1;
          } else {
            var result23 = null;
            if (reportMatchFailures) {
              matchFailed("\"!\"");
            }
          }
          if (result23 !== null) {
            var result3 = result23;
          } else {
            if (input.substr(pos, 1) === "#") {
              var result22 = "#";
              pos += 1;
            } else {
              var result22 = null;
              if (reportMatchFailures) {
                matchFailed("\"#\"");
              }
            }
            if (result22 !== null) {
              var result3 = result22;
            } else {
              if (input.substr(pos, 1) === "$") {
                var result21 = "$";
                pos += 1;
              } else {
                var result21 = null;
                if (reportMatchFailures) {
                  matchFailed("\"$\"");
                }
              }
              if (result21 !== null) {
                var result3 = result21;
              } else {
                if (input.substr(pos, 1) === "%") {
                  var result20 = "%";
                  pos += 1;
                } else {
                  var result20 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"%\"");
                  }
                }
                if (result20 !== null) {
                  var result3 = result20;
                } else {
                  if (input.substr(pos, 1) === "&") {
                    var result19 = "&";
                    pos += 1;
                  } else {
                    var result19 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"&\"");
                    }
                  }
                  if (result19 !== null) {
                    var result3 = result19;
                  } else {
                    if (input.substr(pos, 1) === "*") {
                      var result18 = "*";
                      pos += 1;
                    } else {
                      var result18 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"*\"");
                      }
                    }
                    if (result18 !== null) {
                      var result3 = result18;
                    } else {
                      if (input.substr(pos, 1) === "+") {
                        var result17 = "+";
                        pos += 1;
                      } else {
                        var result17 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"+\"");
                        }
                      }
                      if (result17 !== null) {
                        var result3 = result17;
                      } else {
                        if (input.substr(pos, 1) === ".") {
                          var result16 = ".";
                          pos += 1;
                        } else {
                          var result16 = null;
                          if (reportMatchFailures) {
                            matchFailed("\".\"");
                          }
                        }
                        if (result16 !== null) {
                          var result3 = result16;
                        } else {
                          if (input.substr(pos, 1) === "/") {
                            var result15 = "/";
                            pos += 1;
                          } else {
                            var result15 = null;
                            if (reportMatchFailures) {
                              matchFailed("\"/\"");
                            }
                          }
                          if (result15 !== null) {
                            var result3 = result15;
                          } else {
                            if (input.substr(pos, 1) === "<") {
                              var result14 = "<";
                              pos += 1;
                            } else {
                              var result14 = null;
                              if (reportMatchFailures) {
                                matchFailed("\"<\"");
                              }
                            }
                            if (result14 !== null) {
                              var result3 = result14;
                            } else {
                              if (input.substr(pos, 1) === ">") {
                                var result13 = ">";
                                pos += 1;
                              } else {
                                var result13 = null;
                                if (reportMatchFailures) {
                                  matchFailed("\">\"");
                                }
                              }
                              if (result13 !== null) {
                                var result3 = result13;
                              } else {
                                if (input.substr(pos, 1) === "=") {
                                  var result12 = "=";
                                  pos += 1;
                                } else {
                                  var result12 = null;
                                  if (reportMatchFailures) {
                                    matchFailed("\"=\"");
                                  }
                                }
                                if (result12 !== null) {
                                  var result3 = result12;
                                } else {
                                  if (input.substr(pos, 1) === "?") {
                                    var result11 = "?";
                                    pos += 1;
                                  } else {
                                    var result11 = null;
                                    if (reportMatchFailures) {
                                      matchFailed("\"?\"");
                                    }
                                  }
                                  if (result11 !== null) {
                                    var result3 = result11;
                                  } else {
                                    if (input.substr(pos, 1) === "@") {
                                      var result10 = "@";
                                      pos += 1;
                                    } else {
                                      var result10 = null;
                                      if (reportMatchFailures) {
                                        matchFailed("\"@\"");
                                      }
                                    }
                                    if (result10 !== null) {
                                      var result3 = result10;
                                    } else {
                                      if (input.substr(pos, 1) === "\\") {
                                        var result9 = "\\";
                                        pos += 1;
                                      } else {
                                        var result9 = null;
                                        if (reportMatchFailures) {
                                          matchFailed("\"\\\\\"");
                                        }
                                      }
                                      if (result9 !== null) {
                                        var result3 = result9;
                                      } else {
                                        if (input.substr(pos, 1) === "^") {
                                          var result8 = "^";
                                          pos += 1;
                                        } else {
                                          var result8 = null;
                                          if (reportMatchFailures) {
                                            matchFailed("\"^\"");
                                          }
                                        }
                                        if (result8 !== null) {
                                          var result3 = result8;
                                        } else {
                                          if (input.substr(pos, 1) === "|") {
                                            var result7 = "|";
                                            pos += 1;
                                          } else {
                                            var result7 = null;
                                            if (reportMatchFailures) {
                                              matchFailed("\"|\"");
                                            }
                                          }
                                          if (result7 !== null) {
                                            var result3 = result7;
                                          } else {
                                            if (input.substr(pos, 1) === "-") {
                                              var result6 = "-";
                                              pos += 1;
                                            } else {
                                              var result6 = null;
                                              if (reportMatchFailures) {
                                                matchFailed("\"-\"");
                                              }
                                            }
                                            if (result6 !== null) {
                                              var result3 = result6;
                                            } else {
                                              if (input.substr(pos, 1) === "~") {
                                                var result5 = "~";
                                                pos += 1;
                                              } else {
                                                var result5 = null;
                                                if (reportMatchFailures) {
                                                  matchFailed("\"~\"");
                                                }
                                              }
                                              if (result5 !== null) {
                                                var result3 = result5;
                                              } else {
                                                if (input.substr(pos, 1) === ":") {
                                                  var result4 = ":";
                                                  pos += 1;
                                                } else {
                                                  var result4 = null;
                                                  if (reportMatchFailures) {
                                                    matchFailed("\":\"");
                                                  }
                                                }
                                                if (result4 !== null) {
                                                  var result3 = result4;
                                                } else {
                                                  var result3 = null;;
                                                };
                                              };
                                            };
                                          };
                                        };
                                      };
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(s) {return s})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ascDigit() {
        var cacheKey = 'ascDigit@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos).match(/^[0-9]/) !== null) {
          var result0 = input.charAt(pos);
          pos++;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("[0-9]");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_octit() {
        var cacheKey = 'octit@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos).match(/^[0-7]/) !== null) {
          var result0 = input.charAt(pos);
          pos++;
        } else {
          var result0 = null;
          if (reportMatchFailures) {
            matchFailed("[0-7]");
          }
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_hexit() {
        var cacheKey = 'hexit@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result3 = parse_ascDigit();
        if (result3 !== null) {
          var result0 = result3;
        } else {
          if (input.substr(pos).match(/^[A-F]/) !== null) {
            var result2 = input.charAt(pos);
            pos++;
          } else {
            var result2 = null;
            if (reportMatchFailures) {
              matchFailed("[A-F]");
            }
          }
          if (result2 !== null) {
            var result0 = result2;
          } else {
            if (input.substr(pos).match(/^[a-f]/) !== null) {
              var result1 = input.charAt(pos);
              pos++;
            } else {
              var result1 = null;
              if (reportMatchFailures) {
                matchFailed("[a-f]");
              }
            }
            if (result1 !== null) {
              var result0 = result1;
            } else {
              var result0 = null;;
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_varid() {
        var cacheKey = 'varid@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos1 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        var result10 = parse_reservedid();
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result10 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos1;
        }
        if (result2 !== null) {
          var result3 = parse_small();
          if (result3 !== null) {
            var result4 = [];
            var result9 = parse_small();
            if (result9 !== null) {
              var result5 = result9;
            } else {
              var result8 = parse_ascLarge();
              if (result8 !== null) {
                var result5 = result8;
              } else {
                var result7 = parse_ascDigit();
                if (result7 !== null) {
                  var result5 = result7;
                } else {
                  if (input.substr(pos, 1) === "'") {
                    var result6 = "'";
                    pos += 1;
                  } else {
                    var result6 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"'\"");
                    }
                  }
                  if (result6 !== null) {
                    var result5 = result6;
                  } else {
                    var result5 = null;;
                  };
                };
              };
            }
            while (result5 !== null) {
              result4.push(result5);
              var result9 = parse_small();
              if (result9 !== null) {
                var result5 = result9;
              } else {
                var result8 = parse_ascLarge();
                if (result8 !== null) {
                  var result5 = result8;
                } else {
                  var result7 = parse_ascDigit();
                  if (result7 !== null) {
                    var result5 = result7;
                  } else {
                    if (input.substr(pos, 1) === "'") {
                      var result6 = "'";
                      pos += 1;
                    } else {
                      var result6 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"'\"");
                      }
                    }
                    if (result6 !== null) {
                      var result5 = result6;
                    } else {
                      var result5 = null;;
                    };
                  };
                };
              }
            }
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(head, tail) {return head.concat(tail.join(""))})(result1[1], result1[2])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_conid() {
        var cacheKey = 'conid@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var result2 = parse_ascLarge();
        if (result2 !== null) {
          var result3 = [];
          var result8 = parse_small();
          if (result8 !== null) {
            var result4 = result8;
          } else {
            var result7 = parse_ascLarge();
            if (result7 !== null) {
              var result4 = result7;
            } else {
              var result6 = parse_ascDigit();
              if (result6 !== null) {
                var result4 = result6;
              } else {
                if (input.substr(pos, 1) === "'") {
                  var result5 = "'";
                  pos += 1;
                } else {
                  var result5 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"'\"");
                  }
                }
                if (result5 !== null) {
                  var result4 = result5;
                } else {
                  var result4 = null;;
                };
              };
            };
          }
          while (result4 !== null) {
            result3.push(result4);
            var result8 = parse_small();
            if (result8 !== null) {
              var result4 = result8;
            } else {
              var result7 = parse_ascLarge();
              if (result7 !== null) {
                var result4 = result7;
              } else {
                var result6 = parse_ascDigit();
                if (result6 !== null) {
                  var result4 = result6;
                } else {
                  if (input.substr(pos, 1) === "'") {
                    var result5 = "'";
                    pos += 1;
                  } else {
                    var result5 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"'\"");
                    }
                  }
                  if (result5 !== null) {
                    var result4 = result5;
                  } else {
                    var result4 = null;;
                  };
                };
              };
            }
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(head, tail) {return head.concat(tail.join(""))})(result1[0], result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_reservedid() {
        var cacheKey = 'reservedid@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 6) === "hiding") {
          var result30 = "hiding";
          pos += 6;
        } else {
          var result30 = null;
          if (reportMatchFailures) {
            matchFailed("\"hiding\"");
          }
        }
        if (result30 !== null) {
          var result2 = result30;
        } else {
          if (input.substr(pos, 4) === "case") {
            var result29 = "case";
            pos += 4;
          } else {
            var result29 = null;
            if (reportMatchFailures) {
              matchFailed("\"case\"");
            }
          }
          if (result29 !== null) {
            var result2 = result29;
          } else {
            if (input.substr(pos, 5) === "class") {
              var result28 = "class";
              pos += 5;
            } else {
              var result28 = null;
              if (reportMatchFailures) {
                matchFailed("\"class\"");
              }
            }
            if (result28 !== null) {
              var result2 = result28;
            } else {
              if (input.substr(pos, 4) === "data") {
                var result27 = "data";
                pos += 4;
              } else {
                var result27 = null;
                if (reportMatchFailures) {
                  matchFailed("\"data\"");
                }
              }
              if (result27 !== null) {
                var result2 = result27;
              } else {
                if (input.substr(pos, 7) === "default") {
                  var result26 = "default";
                  pos += 7;
                } else {
                  var result26 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"default\"");
                  }
                }
                if (result26 !== null) {
                  var result2 = result26;
                } else {
                  if (input.substr(pos, 8) === "deriving") {
                    var result25 = "deriving";
                    pos += 8;
                  } else {
                    var result25 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"deriving\"");
                    }
                  }
                  if (result25 !== null) {
                    var result2 = result25;
                  } else {
                    if (input.substr(pos, 2) === "do") {
                      var result24 = "do";
                      pos += 2;
                    } else {
                      var result24 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"do\"");
                      }
                    }
                    if (result24 !== null) {
                      var result2 = result24;
                    } else {
                      if (input.substr(pos, 4) === "else") {
                        var result23 = "else";
                        pos += 4;
                      } else {
                        var result23 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"else\"");
                        }
                      }
                      if (result23 !== null) {
                        var result2 = result23;
                      } else {
                        if (input.substr(pos, 7) === "foreign") {
                          var result22 = "foreign";
                          pos += 7;
                        } else {
                          var result22 = null;
                          if (reportMatchFailures) {
                            matchFailed("\"foreign\"");
                          }
                        }
                        if (result22 !== null) {
                          var result2 = result22;
                        } else {
                          if (input.substr(pos, 2) === "if") {
                            var result21 = "if";
                            pos += 2;
                          } else {
                            var result21 = null;
                            if (reportMatchFailures) {
                              matchFailed("\"if\"");
                            }
                          }
                          if (result21 !== null) {
                            var result2 = result21;
                          } else {
                            if (input.substr(pos, 6) === "import") {
                              var result20 = "import";
                              pos += 6;
                            } else {
                              var result20 = null;
                              if (reportMatchFailures) {
                                matchFailed("\"import\"");
                              }
                            }
                            if (result20 !== null) {
                              var result2 = result20;
                            } else {
                              if (input.substr(pos, 6) === "infixl") {
                                var result19 = "infixl";
                                pos += 6;
                              } else {
                                var result19 = null;
                                if (reportMatchFailures) {
                                  matchFailed("\"infixl\"");
                                }
                              }
                              if (result19 !== null) {
                                var result2 = result19;
                              } else {
                                if (input.substr(pos, 6) === "infixr") {
                                  var result18 = "infixr";
                                  pos += 6;
                                } else {
                                  var result18 = null;
                                  if (reportMatchFailures) {
                                    matchFailed("\"infixr\"");
                                  }
                                }
                                if (result18 !== null) {
                                  var result2 = result18;
                                } else {
                                  if (input.substr(pos, 5) === "infix") {
                                    var result17 = "infix";
                                    pos += 5;
                                  } else {
                                    var result17 = null;
                                    if (reportMatchFailures) {
                                      matchFailed("\"infix\"");
                                    }
                                  }
                                  if (result17 !== null) {
                                    var result2 = result17;
                                  } else {
                                    if (input.substr(pos, 8) === "instance") {
                                      var result16 = "instance";
                                      pos += 8;
                                    } else {
                                      var result16 = null;
                                      if (reportMatchFailures) {
                                        matchFailed("\"instance\"");
                                      }
                                    }
                                    if (result16 !== null) {
                                      var result2 = result16;
                                    } else {
                                      if (input.substr(pos, 2) === "in") {
                                        var result15 = "in";
                                        pos += 2;
                                      } else {
                                        var result15 = null;
                                        if (reportMatchFailures) {
                                          matchFailed("\"in\"");
                                        }
                                      }
                                      if (result15 !== null) {
                                        var result2 = result15;
                                      } else {
                                        if (input.substr(pos, 3) === "let") {
                                          var result14 = "let";
                                          pos += 3;
                                        } else {
                                          var result14 = null;
                                          if (reportMatchFailures) {
                                            matchFailed("\"let\"");
                                          }
                                        }
                                        if (result14 !== null) {
                                          var result2 = result14;
                                        } else {
                                          if (input.substr(pos, 6) === "module") {
                                            var result13 = "module";
                                            pos += 6;
                                          } else {
                                            var result13 = null;
                                            if (reportMatchFailures) {
                                              matchFailed("\"module\"");
                                            }
                                          }
                                          if (result13 !== null) {
                                            var result2 = result13;
                                          } else {
                                            if (input.substr(pos, 7) === "newtype") {
                                              var result12 = "newtype";
                                              pos += 7;
                                            } else {
                                              var result12 = null;
                                              if (reportMatchFailures) {
                                                matchFailed("\"newtype\"");
                                              }
                                            }
                                            if (result12 !== null) {
                                              var result2 = result12;
                                            } else {
                                              if (input.substr(pos, 2) === "of") {
                                                var result11 = "of";
                                                pos += 2;
                                              } else {
                                                var result11 = null;
                                                if (reportMatchFailures) {
                                                  matchFailed("\"of\"");
                                                }
                                              }
                                              if (result11 !== null) {
                                                var result2 = result11;
                                              } else {
                                                if (input.substr(pos, 4) === "then") {
                                                  var result10 = "then";
                                                  pos += 4;
                                                } else {
                                                  var result10 = null;
                                                  if (reportMatchFailures) {
                                                    matchFailed("\"then\"");
                                                  }
                                                }
                                                if (result10 !== null) {
                                                  var result2 = result10;
                                                } else {
                                                  if (input.substr(pos, 4) === "type") {
                                                    var result9 = "type";
                                                    pos += 4;
                                                  } else {
                                                    var result9 = null;
                                                    if (reportMatchFailures) {
                                                      matchFailed("\"type\"");
                                                    }
                                                  }
                                                  if (result9 !== null) {
                                                    var result2 = result9;
                                                  } else {
                                                    if (input.substr(pos, 5) === "where") {
                                                      var result8 = "where";
                                                      pos += 5;
                                                    } else {
                                                      var result8 = null;
                                                      if (reportMatchFailures) {
                                                        matchFailed("\"where\"");
                                                      }
                                                    }
                                                    if (result8 !== null) {
                                                      var result2 = result8;
                                                    } else {
                                                      if (input.substr(pos, 1) === "_") {
                                                        var result7 = "_";
                                                        pos += 1;
                                                      } else {
                                                        var result7 = null;
                                                        if (reportMatchFailures) {
                                                          matchFailed("\"_\"");
                                                        }
                                                      }
                                                      if (result7 !== null) {
                                                        var result2 = result7;
                                                      } else {
                                                        var result2 = null;;
                                                      };
                                                    };
                                                  };
                                                };
                                              };
                                            };
                                          };
                                        };
                                      };
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedReportMatchFailuresVar0 = reportMatchFailures;
          reportMatchFailures = false;
          var result6 = parse_varid();
          if (result6 !== null) {
            var result4 = result6;
          } else {
            var result5 = parse_reservedid();
            if (result5 !== null) {
              var result4 = result5;
            } else {
              var result4 = null;;
            };
          }
          reportMatchFailures = savedReportMatchFailuresVar0;
          if (result4 === null) {
            var result3 = '';
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(res) {return {val: res, typ: res}})(result1[0])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_varsym() {
        var cacheKey = 'varsym@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos1 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        var result9 = parse_reservedop();
        if (result9 !== null) {
          var result5 = result9;
        } else {
          var result8 = parse_dashes();
          if (result8 !== null) {
            var result5 = result8;
          } else {
            var result7 = parse_escape();
            if (result7 !== null) {
              var result5 = result7;
            } else {
              if (input.substr(pos, 1) === ":") {
                var result6 = ":";
                pos += 1;
              } else {
                var result6 = null;
                if (reportMatchFailures) {
                  matchFailed("\":\"");
                }
              }
              if (result6 !== null) {
                var result5 = result6;
              } else {
                var result5 = null;;
              };
            };
          };
        }
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result5 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos1;
        }
        if (result2 !== null) {
          var result4 = parse_symbol();
          if (result4 !== null) {
            var result3 = [];
            while (result4 !== null) {
              result3.push(result4);
              var result4 = parse_symbol();
            }
          } else {
            var result3 = null;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(s) {return s.join("")})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_consym() {
        var cacheKey = 'consym@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos2 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        var result7 = parse_reservedop();
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result7 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos2;
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          if (input.substr(pos, 1) === ":") {
            var result4 = ":";
            pos += 1;
          } else {
            var result4 = null;
            if (reportMatchFailures) {
              matchFailed("\":\"");
            }
          }
          if (result4 !== null) {
            var result5 = [];
            var result6 = parse_symbol();
            while (result6 !== null) {
              result5.push(result6);
              var result6 = parse_symbol();
            }
            if (result5 !== null) {
              var result3 = [result4, result5];
            } else {
              var result3 = null;
              pos = savedPos1;
            }
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(s) {return flatten(s).join("")})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_reservedop() {
        var cacheKey = 'reservedop@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 2) === "..") {
          var result26 = "..";
          pos += 2;
        } else {
          var result26 = null;
          if (reportMatchFailures) {
            matchFailed("\"..\"");
          }
        }
        if (result26 !== null) {
          var result2 = result26;
        } else {
          if (input.substr(pos, 2) === "::") {
            var result25 = "::";
            pos += 2;
          } else {
            var result25 = null;
            if (reportMatchFailures) {
              matchFailed("\"::\"");
            }
          }
          if (result25 !== null) {
            var result2 = result25;
          } else {
            if (input.substr(pos, 1) === ":") {
              var result24 = ":";
              pos += 1;
            } else {
              var result24 = null;
              if (reportMatchFailures) {
                matchFailed("\":\"");
              }
            }
            if (result24 !== null) {
              var result2 = result24;
            } else {
              if (input.substr(pos, 2) === "=>") {
                var result23 = "=>";
                pos += 2;
              } else {
                var result23 = null;
                if (reportMatchFailures) {
                  matchFailed("\"=>\"");
                }
              }
              if (result23 !== null) {
                var result2 = result23;
              } else {
                var savedPos6 = pos;
                if (input.substr(pos, 1) === "=") {
                  var result20 = "=";
                  pos += 1;
                } else {
                  var result20 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"=\"");
                  }
                }
                if (result20 !== null) {
                  var savedPos7 = pos;
                  var savedReportMatchFailuresVar3 = reportMatchFailures;
                  reportMatchFailures = false;
                  if (input.substr(pos, 1) === "=") {
                    var result22 = "=";
                    pos += 1;
                  } else {
                    var result22 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"=\"");
                    }
                  }
                  reportMatchFailures = savedReportMatchFailuresVar3;
                  if (result22 === null) {
                    var result21 = '';
                  } else {
                    var result21 = null;
                    pos = savedPos7;
                  }
                  if (result21 !== null) {
                    var result19 = [result20, result21];
                  } else {
                    var result19 = null;
                    pos = savedPos6;
                  }
                } else {
                  var result19 = null;
                  pos = savedPos6;
                }
                if (result19 !== null) {
                  var result2 = result19;
                } else {
                  var savedPos4 = pos;
                  if (input.substr(pos, 1) === "\\") {
                    var result16 = "\\";
                    pos += 1;
                  } else {
                    var result16 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"\\\\\"");
                    }
                  }
                  if (result16 !== null) {
                    var savedPos5 = pos;
                    var savedReportMatchFailuresVar2 = reportMatchFailures;
                    reportMatchFailures = false;
                    var result18 = parse_escapestuff();
                    reportMatchFailures = savedReportMatchFailuresVar2;
                    if (result18 === null) {
                      var result17 = '';
                    } else {
                      var result17 = null;
                      pos = savedPos5;
                    }
                    if (result17 !== null) {
                      var result15 = [result16, result17];
                    } else {
                      var result15 = null;
                      pos = savedPos4;
                    }
                  } else {
                    var result15 = null;
                    pos = savedPos4;
                  }
                  if (result15 !== null) {
                    var result2 = result15;
                  } else {
                    var savedPos2 = pos;
                    if (input.substr(pos, 1) === "|") {
                      var result12 = "|";
                      pos += 1;
                    } else {
                      var result12 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"|\"");
                      }
                    }
                    if (result12 !== null) {
                      var savedPos3 = pos;
                      var savedReportMatchFailuresVar1 = reportMatchFailures;
                      reportMatchFailures = false;
                      if (input.substr(pos, 1) === "|") {
                        var result14 = "|";
                        pos += 1;
                      } else {
                        var result14 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"|\"");
                        }
                      }
                      reportMatchFailures = savedReportMatchFailuresVar1;
                      if (result14 === null) {
                        var result13 = '';
                      } else {
                        var result13 = null;
                        pos = savedPos3;
                      }
                      if (result13 !== null) {
                        var result11 = [result12, result13];
                      } else {
                        var result11 = null;
                        pos = savedPos2;
                      }
                    } else {
                      var result11 = null;
                      pos = savedPos2;
                    }
                    if (result11 !== null) {
                      var result2 = result11;
                    } else {
                      if (input.substr(pos, 2) === "<-") {
                        var result10 = "<-";
                        pos += 2;
                      } else {
                        var result10 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"<-\"");
                        }
                      }
                      if (result10 !== null) {
                        var result2 = result10;
                      } else {
                        if (input.substr(pos, 2) === "->") {
                          var result9 = "->";
                          pos += 2;
                        } else {
                          var result9 = null;
                          if (reportMatchFailures) {
                            matchFailed("\"->\"");
                          }
                        }
                        if (result9 !== null) {
                          var result2 = result9;
                        } else {
                          if (input.substr(pos, 1) === "@") {
                            var result8 = "@";
                            pos += 1;
                          } else {
                            var result8 = null;
                            if (reportMatchFailures) {
                              matchFailed("\"@\"");
                            }
                          }
                          if (result8 !== null) {
                            var result2 = result8;
                          } else {
                            if (input.substr(pos, 1) === "~") {
                              var result7 = "~";
                              pos += 1;
                            } else {
                              var result7 = null;
                              if (reportMatchFailures) {
                                matchFailed("\"~\"");
                              }
                            }
                            if (result7 !== null) {
                              var result2 = result7;
                            } else {
                              var result2 = null;;
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedReportMatchFailuresVar0 = reportMatchFailures;
          reportMatchFailures = false;
          var result6 = parse_varsym();
          if (result6 !== null) {
            var result4 = result6;
          } else {
            var result5 = parse_consym();
            if (result5 !== null) {
              var result4 = result5;
            } else {
              var result4 = null;;
            };
          }
          reportMatchFailures = savedReportMatchFailuresVar0;
          if (result4 === null) {
            var result3 = '';
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(op) {return {val: (op instanceof Array)? op.join(""): op, typ: (op instanceof Array)? op.join(""): op}})(result1[0])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_qvarid() {
        var cacheKey = 'qvarid@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos5 = pos;
        var result11 = parse_conid();
        if (result11 !== null) {
          if (input.substr(pos, 1) === ".") {
            var result12 = ".";
            pos += 1;
          } else {
            var result12 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          if (result12 !== null) {
            var result10 = [result11, result12];
          } else {
            var result10 = null;
            pos = savedPos5;
          }
        } else {
          var result10 = null;
          pos = savedPos5;
        }
        if (result10 !== null) {
          var result2 = [];
          while (result10 !== null) {
            result2.push(result10);
            var savedPos5 = pos;
            var result11 = parse_conid();
            if (result11 !== null) {
              if (input.substr(pos, 1) === ".") {
                var result12 = ".";
                pos += 1;
              } else {
                var result12 = null;
                if (reportMatchFailures) {
                  matchFailed("\".\"");
                }
              }
              if (result12 !== null) {
                var result10 = [result11, result12];
              } else {
                var result10 = null;
                pos = savedPos5;
              }
            } else {
              var result10 = null;
              pos = savedPos5;
            }
          }
        } else {
          var result2 = null;
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedPos3 = pos;
          var savedPos4 = pos;
          var savedReportMatchFailuresVar1 = reportMatchFailures;
          reportMatchFailures = false;
          if (input.substr(pos, 1) === ".") {
            var result9 = ".";
            pos += 1;
          } else {
            var result9 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          reportMatchFailures = savedReportMatchFailuresVar1;
          if (result9 === null) {
            var result7 = '';
          } else {
            var result7 = null;
            pos = savedPos4;
          }
          if (result7 !== null) {
            var result8 = parse_varid();
            if (result8 !== null) {
              var result4 = [result7, result8];
            } else {
              var result4 = null;
              pos = savedPos3;
            }
          } else {
            var result4 = null;
            pos = savedPos3;
          }
          if (result4 !== null) {
            var savedPos2 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result6 = ".";
              pos += 1;
            } else {
              var result6 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result6 === null) {
              var result5 = '';
            } else {
              var result5 = null;
              pos = savedPos2;
            }
            if (result5 !== null) {
              var result3 = [result4, result5];
            } else {
              var result3 = null;
              pos = savedPos1;
            }
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(qs, ref) {qs = flatten(qs).join(""); return {val: flatten([qs, ref[0]]).join(""), typ: "qvarid", qual: qs.substr(0,qs.length-1)}})(result1[0], result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_qconid() {
        var cacheKey = 'qconid@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos5 = pos;
        var result11 = parse_conid();
        if (result11 !== null) {
          if (input.substr(pos, 1) === ".") {
            var result12 = ".";
            pos += 1;
          } else {
            var result12 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          if (result12 !== null) {
            var result10 = [result11, result12];
          } else {
            var result10 = null;
            pos = savedPos5;
          }
        } else {
          var result10 = null;
          pos = savedPos5;
        }
        if (result10 !== null) {
          var result2 = [];
          while (result10 !== null) {
            result2.push(result10);
            var savedPos5 = pos;
            var result11 = parse_conid();
            if (result11 !== null) {
              if (input.substr(pos, 1) === ".") {
                var result12 = ".";
                pos += 1;
              } else {
                var result12 = null;
                if (reportMatchFailures) {
                  matchFailed("\".\"");
                }
              }
              if (result12 !== null) {
                var result10 = [result11, result12];
              } else {
                var result10 = null;
                pos = savedPos5;
              }
            } else {
              var result10 = null;
              pos = savedPos5;
            }
          }
        } else {
          var result2 = null;
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedPos3 = pos;
          var savedPos4 = pos;
          var savedReportMatchFailuresVar1 = reportMatchFailures;
          reportMatchFailures = false;
          if (input.substr(pos, 1) === ".") {
            var result9 = ".";
            pos += 1;
          } else {
            var result9 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          reportMatchFailures = savedReportMatchFailuresVar1;
          if (result9 === null) {
            var result7 = '';
          } else {
            var result7 = null;
            pos = savedPos4;
          }
          if (result7 !== null) {
            var result8 = parse_conid();
            if (result8 !== null) {
              var result4 = [result7, result8];
            } else {
              var result4 = null;
              pos = savedPos3;
            }
          } else {
            var result4 = null;
            pos = savedPos3;
          }
          if (result4 !== null) {
            var savedPos2 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result6 = ".";
              pos += 1;
            } else {
              var result6 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result6 === null) {
              var result5 = '';
            } else {
              var result5 = null;
              pos = savedPos2;
            }
            if (result5 !== null) {
              var result3 = [result4, result5];
            } else {
              var result3 = null;
              pos = savedPos1;
            }
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(qs, ref) {qs = flatten(qs).join(""); return {val: flatten([qs, ref[0]]).join(""), typ: "qconid", qual: qs.substr(0,qs.length-1)}})(result1[0], result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_qvarsym() {
        var cacheKey = 'qvarsym@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos3 = pos;
        var result8 = parse_conid();
        if (result8 !== null) {
          if (input.substr(pos, 1) === ".") {
            var result9 = ".";
            pos += 1;
          } else {
            var result9 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          if (result9 !== null) {
            var result7 = [result8, result9];
          } else {
            var result7 = null;
            pos = savedPos3;
          }
        } else {
          var result7 = null;
          pos = savedPos3;
        }
        if (result7 !== null) {
          var result2 = [];
          while (result7 !== null) {
            result2.push(result7);
            var savedPos3 = pos;
            var result8 = parse_conid();
            if (result8 !== null) {
              if (input.substr(pos, 1) === ".") {
                var result9 = ".";
                pos += 1;
              } else {
                var result9 = null;
                if (reportMatchFailures) {
                  matchFailed("\".\"");
                }
              }
              if (result9 !== null) {
                var result7 = [result8, result9];
              } else {
                var result7 = null;
                pos = savedPos3;
              }
            } else {
              var result7 = null;
              pos = savedPos3;
            }
          }
        } else {
          var result2 = null;
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var result4 = parse_varsym();
          if (result4 !== null) {
            var savedPos2 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result6 = ".";
              pos += 1;
            } else {
              var result6 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result6 === null) {
              var result5 = '';
            } else {
              var result5 = null;
              pos = savedPos2;
            }
            if (result5 !== null) {
              var result3 = [result4, result5];
            } else {
              var result3 = null;
              pos = savedPos1;
            }
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(qs, ref) {qs = flatten(qs).join(""); return {val: flatten([qs, ref[0]]).join(""), typ: "qvarsym", qual: qs.substr(0,qs.length-1)}})(result1[0], result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_qconsym() {
        var cacheKey = 'qconsym@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos5 = pos;
        var result11 = parse_conid();
        if (result11 !== null) {
          if (input.substr(pos, 1) === ".") {
            var result12 = ".";
            pos += 1;
          } else {
            var result12 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          if (result12 !== null) {
            var result10 = [result11, result12];
          } else {
            var result10 = null;
            pos = savedPos5;
          }
        } else {
          var result10 = null;
          pos = savedPos5;
        }
        if (result10 !== null) {
          var result2 = [];
          while (result10 !== null) {
            result2.push(result10);
            var savedPos5 = pos;
            var result11 = parse_conid();
            if (result11 !== null) {
              if (input.substr(pos, 1) === ".") {
                var result12 = ".";
                pos += 1;
              } else {
                var result12 = null;
                if (reportMatchFailures) {
                  matchFailed("\".\"");
                }
              }
              if (result12 !== null) {
                var result10 = [result11, result12];
              } else {
                var result10 = null;
                pos = savedPos5;
              }
            } else {
              var result10 = null;
              pos = savedPos5;
            }
          }
        } else {
          var result2 = null;
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedPos3 = pos;
          var savedPos4 = pos;
          var savedReportMatchFailuresVar1 = reportMatchFailures;
          reportMatchFailures = false;
          if (input.substr(pos, 1) === ".") {
            var result9 = ".";
            pos += 1;
          } else {
            var result9 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          reportMatchFailures = savedReportMatchFailuresVar1;
          if (result9 === null) {
            var result7 = '';
          } else {
            var result7 = null;
            pos = savedPos4;
          }
          if (result7 !== null) {
            var result8 = parse_consym();
            if (result8 !== null) {
              var result4 = [result7, result8];
            } else {
              var result4 = null;
              pos = savedPos3;
            }
          } else {
            var result4 = null;
            pos = savedPos3;
          }
          if (result4 !== null) {
            var savedPos2 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result6 = ".";
              pos += 1;
            } else {
              var result6 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result6 === null) {
              var result5 = '';
            } else {
              var result5 = null;
              pos = savedPos2;
            }
            if (result5 !== null) {
              var result3 = [result4, result5];
            } else {
              var result3 = null;
              pos = savedPos1;
            }
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(qs, ref) {qs = flatten(qs).join(""); return {val: flatten([qs, ref[0]]).join(""), typ: "qconsym", qual: qs.substr(0,qs.length-1)}})(result1[0], result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_varid_e() {
        var cacheKey = 'varid_e@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos2 = pos;
        var savedReportMatchFailuresVar1 = reportMatchFailures;
        reportMatchFailures = false;
        if (input.substr(pos, 1) === ".") {
          var result6 = ".";
          pos += 1;
        } else {
          var result6 = null;
          if (reportMatchFailures) {
            matchFailed("\".\"");
          }
        }
        reportMatchFailures = savedReportMatchFailuresVar1;
        if (result6 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos2;
        }
        if (result2 !== null) {
          var result3 = parse_varid();
          if (result3 !== null) {
            var savedPos1 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result5 = ".";
              pos += 1;
            } else {
              var result5 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result5 === null) {
              var result4 = '';
            } else {
              var result4 = null;
              pos = savedPos1;
            }
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(v) {return {val: v, typ: "varid"}})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_conid_e() {
        var cacheKey = 'conid_e@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos2 = pos;
        var savedReportMatchFailuresVar1 = reportMatchFailures;
        reportMatchFailures = false;
        if (input.substr(pos, 1) === ".") {
          var result6 = ".";
          pos += 1;
        } else {
          var result6 = null;
          if (reportMatchFailures) {
            matchFailed("\".\"");
          }
        }
        reportMatchFailures = savedReportMatchFailuresVar1;
        if (result6 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos2;
        }
        if (result2 !== null) {
          var result3 = parse_conid();
          if (result3 !== null) {
            var savedPos1 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result5 = ".";
              pos += 1;
            } else {
              var result5 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result5 === null) {
              var result4 = '';
            } else {
              var result4 = null;
              pos = savedPos1;
            }
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(c) {return {val: c, typ: "conid"}})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_varsym_e() {
        var cacheKey = 'varsym_e@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var result2 = parse_varsym();
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedReportMatchFailuresVar0 = reportMatchFailures;
          reportMatchFailures = false;
          if (input.substr(pos, 1) === ".") {
            var result4 = ".";
            pos += 1;
          } else {
            var result4 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          reportMatchFailures = savedReportMatchFailuresVar0;
          if (result4 === null) {
            var result3 = '';
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(v) {return {val: v, typ: "varsym"}})(result1[0])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_consym_e() {
        var cacheKey = 'consym_e@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos2 = pos;
        var savedReportMatchFailuresVar1 = reportMatchFailures;
        reportMatchFailures = false;
        if (input.substr(pos, 1) === ".") {
          var result6 = ".";
          pos += 1;
        } else {
          var result6 = null;
          if (reportMatchFailures) {
            matchFailed("\".\"");
          }
        }
        reportMatchFailures = savedReportMatchFailuresVar1;
        if (result6 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos2;
        }
        if (result2 !== null) {
          var result3 = parse_consym();
          if (result3 !== null) {
            var savedPos1 = pos;
            var savedReportMatchFailuresVar0 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === ".") {
              var result5 = ".";
              pos += 1;
            } else {
              var result5 = null;
              if (reportMatchFailures) {
                matchFailed("\".\"");
              }
            }
            reportMatchFailures = savedReportMatchFailuresVar0;
            if (result5 === null) {
              var result4 = '';
            } else {
              var result4 = null;
              pos = savedPos1;
            }
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(c) {return {val: c, typ: "consym"}})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_decimal() {
        var cacheKey = 'decimal@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result2 = parse_ascDigit();
        if (result2 !== null) {
          var result1 = [];
          while (result2 !== null) {
            result1.push(result2);
            var result2 = parse_ascDigit();
          }
        } else {
          var result1 = null;
        }
        var result0 = result1 !== null
          ? (function(d) {return d.join("")})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_octal() {
        var cacheKey = 'octal@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result2 = parse_octit();
        if (result2 !== null) {
          var result1 = [];
          while (result2 !== null) {
            result1.push(result2);
            var result2 = parse_octit();
          }
        } else {
          var result1 = null;
        }
        var result0 = result1 !== null
          ? (function(o) {return o.join("")})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_hexadecimal() {
        var cacheKey = 'hexadecimal@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result2 = parse_hexit();
        if (result2 !== null) {
          var result1 = [];
          while (result2 !== null) {
            result1.push(result2);
            var result2 = parse_hexit();
          }
        } else {
          var result1 = null;
        }
        var result0 = result1 !== null
          ? (function(h) {return h.join("")})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_integer() {
        var cacheKey = 'integer@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var result13 = parse_notdecimal();
        if (result13 !== null) {
          var result2 = result13;
        } else {
          var savedPos2 = pos;
          var result6 = parse_decimal();
          if (result6 !== null) {
            var savedPos3 = pos;
            var savedReportMatchFailuresVar1 = reportMatchFailures;
            reportMatchFailures = false;
            if (input.substr(pos, 1) === "o") {
              var result12 = "o";
              pos += 1;
            } else {
              var result12 = null;
              if (reportMatchFailures) {
                matchFailed("\"o\"");
              }
            }
            if (result12 !== null) {
              var result8 = result12;
            } else {
              if (input.substr(pos, 1) === "O") {
                var result11 = "O";
                pos += 1;
              } else {
                var result11 = null;
                if (reportMatchFailures) {
                  matchFailed("\"O\"");
                }
              }
              if (result11 !== null) {
                var result8 = result11;
              } else {
                if (input.substr(pos, 1) === "x") {
                  var result10 = "x";
                  pos += 1;
                } else {
                  var result10 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"x\"");
                  }
                }
                if (result10 !== null) {
                  var result8 = result10;
                } else {
                  if (input.substr(pos, 1) === "X") {
                    var result9 = "X";
                    pos += 1;
                  } else {
                    var result9 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"X\"");
                    }
                  }
                  if (result9 !== null) {
                    var result8 = result9;
                  } else {
                    var result8 = null;;
                  };
                };
              };
            }
            reportMatchFailures = savedReportMatchFailuresVar1;
            if (result8 === null) {
              var result7 = '';
            } else {
              var result7 = null;
              pos = savedPos3;
            }
            if (result7 !== null) {
              var result5 = [result6, result7];
            } else {
              var result5 = null;
              pos = savedPos2;
            }
          } else {
            var result5 = null;
            pos = savedPos2;
          }
          if (result5 !== null) {
            var result2 = result5;
          } else {
            var result2 = null;;
          };
        }
        if (result2 !== null) {
          var savedPos1 = pos;
          var savedReportMatchFailuresVar0 = reportMatchFailures;
          reportMatchFailures = false;
          if (input.substr(pos, 1) === ".") {
            var result4 = ".";
            pos += 1;
          } else {
            var result4 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          reportMatchFailures = savedReportMatchFailuresVar0;
          if (result4 === null) {
            var result3 = '';
          } else {
            var result3 = null;
            pos = savedPos1;
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(i) {return {val: i.join(""), typ: "integer"}})(result1[0])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_notdecimal() {
        var cacheKey = 'notdecimal@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos3 = pos;
        if (input.substr(pos, 2) === "0o") {
          var result11 = "0o";
          pos += 2;
        } else {
          var result11 = null;
          if (reportMatchFailures) {
            matchFailed("\"0o\"");
          }
        }
        if (result11 !== null) {
          var result12 = parse_octal();
          if (result12 !== null) {
            var result10 = [result11, result12];
          } else {
            var result10 = null;
            pos = savedPos3;
          }
        } else {
          var result10 = null;
          pos = savedPos3;
        }
        if (result10 !== null) {
          var result0 = result10;
        } else {
          var savedPos2 = pos;
          if (input.substr(pos, 2) === "0O") {
            var result8 = "0O";
            pos += 2;
          } else {
            var result8 = null;
            if (reportMatchFailures) {
              matchFailed("\"0O\"");
            }
          }
          if (result8 !== null) {
            var result9 = parse_octal();
            if (result9 !== null) {
              var result7 = [result8, result9];
            } else {
              var result7 = null;
              pos = savedPos2;
            }
          } else {
            var result7 = null;
            pos = savedPos2;
          }
          if (result7 !== null) {
            var result0 = result7;
          } else {
            var savedPos1 = pos;
            if (input.substr(pos, 2) === "0x") {
              var result5 = "0x";
              pos += 2;
            } else {
              var result5 = null;
              if (reportMatchFailures) {
                matchFailed("\"0x\"");
              }
            }
            if (result5 !== null) {
              var result6 = parse_hexadecimal();
              if (result6 !== null) {
                var result4 = [result5, result6];
              } else {
                var result4 = null;
                pos = savedPos1;
              }
            } else {
              var result4 = null;
              pos = savedPos1;
            }
            if (result4 !== null) {
              var result0 = result4;
            } else {
              var savedPos0 = pos;
              if (input.substr(pos, 2) === "0X") {
                var result2 = "0X";
                pos += 2;
              } else {
                var result2 = null;
                if (reportMatchFailures) {
                  matchFailed("\"0X\"");
                }
              }
              if (result2 !== null) {
                var result3 = parse_hexadecimal();
                if (result3 !== null) {
                  var result1 = [result2, result3];
                } else {
                  var result1 = null;
                  pos = savedPos0;
                }
              } else {
                var result1 = null;
                pos = savedPos0;
              }
              if (result1 !== null) {
                var result0 = result1;
              } else {
                var result0 = null;;
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_float() {
        var cacheKey = 'float@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos1 = pos;
        var result6 = parse_decimal();
        if (result6 !== null) {
          if (input.substr(pos, 1) === ".") {
            var result7 = ".";
            pos += 1;
          } else {
            var result7 = null;
            if (reportMatchFailures) {
              matchFailed("\".\"");
            }
          }
          if (result7 !== null) {
            var result8 = parse_decimal();
            if (result8 !== null) {
              var result10 = parse_exponent();
              var result9 = result10 !== null ? result10 : '';
              if (result9 !== null) {
                var result5 = [result6, result7, result8, result9];
              } else {
                var result5 = null;
                pos = savedPos1;
              }
            } else {
              var result5 = null;
              pos = savedPos1;
            }
          } else {
            var result5 = null;
            pos = savedPos1;
          }
        } else {
          var result5 = null;
          pos = savedPos1;
        }
        if (result5 !== null) {
          var result1 = result5;
        } else {
          var savedPos0 = pos;
          var result3 = parse_decimal();
          if (result3 !== null) {
            var result4 = parse_exponent();
            if (result4 !== null) {
              var result2 = [result3, result4];
            } else {
              var result2 = null;
              pos = savedPos0;
            }
          } else {
            var result2 = null;
            pos = savedPos0;
          }
          if (result2 !== null) {
            var result1 = result2;
          } else {
            var result1 = null;;
          };
        }
        var result0 = result1 !== null
          ? (function(f) {return {val: f.join(""), typ: "float"}})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_exponent() {
        var cacheKey = 'exponent@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "e") {
          var result9 = "e";
          pos += 1;
        } else {
          var result9 = null;
          if (reportMatchFailures) {
            matchFailed("\"e\"");
          }
        }
        if (result9 !== null) {
          var result2 = result9;
        } else {
          if (input.substr(pos, 1) === "E") {
            var result8 = "E";
            pos += 1;
          } else {
            var result8 = null;
            if (reportMatchFailures) {
              matchFailed("\"E\"");
            }
          }
          if (result8 !== null) {
            var result2 = result8;
          } else {
            var result2 = null;;
          };
        }
        if (result2 !== null) {
          if (input.substr(pos, 1) === "+") {
            var result7 = "+";
            pos += 1;
          } else {
            var result7 = null;
            if (reportMatchFailures) {
              matchFailed("\"+\"");
            }
          }
          if (result7 !== null) {
            var result5 = result7;
          } else {
            if (input.substr(pos, 1) === "-") {
              var result6 = "-";
              pos += 1;
            } else {
              var result6 = null;
              if (reportMatchFailures) {
                matchFailed("\"-\"");
              }
            }
            if (result6 !== null) {
              var result5 = result6;
            } else {
              var result5 = null;;
            };
          }
          var result3 = result5 !== null ? result5 : '';
          if (result3 !== null) {
            var result4 = parse_decimal();
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(e) {return e.join("")})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_char() {
        var cacheKey = 'char@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "'") {
          var result2 = "'";
          pos += 1;
        } else {
          var result2 = null;
          if (reportMatchFailures) {
            matchFailed("\"'\"");
          }
        }
        if (result2 !== null) {
          var savedPos3 = pos;
          var savedPos4 = pos;
          var savedReportMatchFailuresVar1 = reportMatchFailures;
          reportMatchFailures = false;
          if (input.substr(pos, 1) === "'") {
            var result15 = "'";
            pos += 1;
          } else {
            var result15 = null;
            if (reportMatchFailures) {
              matchFailed("\"'\"");
            }
          }
          if (result15 !== null) {
            var result13 = result15;
          } else {
            if (input.substr(pos, 1) === "\\") {
              var result14 = "\\";
              pos += 1;
            } else {
              var result14 = null;
              if (reportMatchFailures) {
                matchFailed("\"\\\\\"");
              }
            }
            if (result14 !== null) {
              var result13 = result14;
            } else {
              var result13 = null;;
            };
          }
          reportMatchFailures = savedReportMatchFailuresVar1;
          if (result13 === null) {
            var result11 = '';
          } else {
            var result11 = null;
            pos = savedPos4;
          }
          if (result11 !== null) {
            var result12 = parse_graphic();
            if (result12 !== null) {
              var result10 = [result11, result12];
            } else {
              var result10 = null;
              pos = savedPos3;
            }
          } else {
            var result10 = null;
            pos = savedPos3;
          }
          if (result10 !== null) {
            var result3 = result10;
          } else {
            var result9 = parse_space();
            if (result9 !== null) {
              var result3 = result9;
            } else {
              var savedPos1 = pos;
              var savedPos2 = pos;
              var savedReportMatchFailuresVar0 = reportMatchFailures;
              reportMatchFailures = false;
              if (input.substr(pos, 2) === "\\&") {
                var result8 = "\\&";
                pos += 2;
              } else {
                var result8 = null;
                if (reportMatchFailures) {
                  matchFailed("\"\\\\&\"");
                }
              }
              reportMatchFailures = savedReportMatchFailuresVar0;
              if (result8 === null) {
                var result6 = '';
              } else {
                var result6 = null;
                pos = savedPos2;
              }
              if (result6 !== null) {
                var result7 = parse_escape();
                if (result7 !== null) {
                  var result5 = [result6, result7];
                } else {
                  var result5 = null;
                  pos = savedPos1;
                }
              } else {
                var result5 = null;
                pos = savedPos1;
              }
              if (result5 !== null) {
                var result3 = result5;
              } else {
                var result3 = null;;
              };
            };
          }
          if (result3 !== null) {
            if (input.substr(pos, 1) === "'") {
              var result4 = "'";
              pos += 1;
            } else {
              var result4 = null;
              if (reportMatchFailures) {
                matchFailed("\"'\"");
              }
            }
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(c) {return {val: ("'" + c.join("") + "'"), typ: "char"}})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_string() {
        var cacheKey = 'string@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "\"") {
          var result2 = "\"";
          pos += 1;
        } else {
          var result2 = null;
          if (reportMatchFailures) {
            matchFailed("\"\\\"\"");
          }
        }
        if (result2 !== null) {
          var result3 = [];
          var result5 = parse_stringchar();
          while (result5 !== null) {
            result3.push(result5);
            var result5 = parse_stringchar();
          }
          if (result3 !== null) {
            if (input.substr(pos, 1) === "\"") {
              var result4 = "\"";
              pos += 1;
            } else {
              var result4 = null;
              if (reportMatchFailures) {
                matchFailed("\"\\\"\"");
              }
            }
            if (result4 !== null) {
              var result1 = [result2, result3, result4];
            } else {
              var result1 = null;
              pos = savedPos0;
            }
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(bod) {return {val: ('"' + bod.join("") + '"'), typ: "string"}})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_stringchar() {
        var cacheKey = 'stringchar@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        var savedPos1 = pos;
        var savedReportMatchFailuresVar0 = reportMatchFailures;
        reportMatchFailures = false;
        if (input.substr(pos, 1) === "\"") {
          var result8 = "\"";
          pos += 1;
        } else {
          var result8 = null;
          if (reportMatchFailures) {
            matchFailed("\"\\\"\"");
          }
        }
        reportMatchFailures = savedReportMatchFailuresVar0;
        if (result8 === null) {
          var result2 = '';
        } else {
          var result2 = null;
          pos = savedPos1;
        }
        if (result2 !== null) {
          var result7 = parse_space();
          if (result7 !== null) {
            var result3 = result7;
          } else {
            var result6 = parse_escape();
            if (result6 !== null) {
              var result3 = result6;
            } else {
              var result5 = parse_graphic();
              if (result5 !== null) {
                var result3 = result5;
              } else {
                var result4 = parse_gap();
                if (result4 !== null) {
                  var result3 = result4;
                } else {
                  var result3 = null;;
                };
              };
            };
          }
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(ch) {return ch})(result1[1])
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_escape() {
        var cacheKey = 'escape@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "\\") {
          var result2 = "\\";
          pos += 1;
        } else {
          var result2 = null;
          if (reportMatchFailures) {
            matchFailed("\"\\\\\"");
          }
        }
        if (result2 !== null) {
          var result3 = parse_escapestuff();
          if (result3 !== null) {
            var result1 = [result2, result3];
          } else {
            var result1 = null;
            pos = savedPos0;
          }
        } else {
          var result1 = null;
          pos = savedPos0;
        }
        var result0 = result1 !== null
          ? (function(esc) {return esc.join("")})(result1)
          : null;
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_escapestuff() {
        var cacheKey = 'escapestuff@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result9 = parse_charesc();
        if (result9 !== null) {
          var result0 = result9;
        } else {
          var result8 = parse_ascii();
          if (result8 !== null) {
            var result0 = result8;
          } else {
            var result7 = parse_decimal();
            if (result7 !== null) {
              var result0 = result7;
            } else {
              var savedPos1 = pos;
              if (input.substr(pos, 1) === "o") {
                var result5 = "o";
                pos += 1;
              } else {
                var result5 = null;
                if (reportMatchFailures) {
                  matchFailed("\"o\"");
                }
              }
              if (result5 !== null) {
                var result6 = parse_octal();
                if (result6 !== null) {
                  var result4 = [result5, result6];
                } else {
                  var result4 = null;
                  pos = savedPos1;
                }
              } else {
                var result4 = null;
                pos = savedPos1;
              }
              if (result4 !== null) {
                var result0 = result4;
              } else {
                var savedPos0 = pos;
                if (input.substr(pos, 1) === "x") {
                  var result2 = "x";
                  pos += 1;
                } else {
                  var result2 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"x\"");
                  }
                }
                if (result2 !== null) {
                  var result3 = parse_hexadecimal();
                  if (result3 !== null) {
                    var result1 = [result2, result3];
                  } else {
                    var result1 = null;
                    pos = savedPos0;
                  }
                } else {
                  var result1 = null;
                  pos = savedPos0;
                }
                if (result1 !== null) {
                  var result0 = result1;
                } else {
                  var result0 = null;;
                };
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_charesc() {
        var cacheKey = 'charesc@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        if (input.substr(pos, 1) === "a") {
          var result11 = "a";
          pos += 1;
        } else {
          var result11 = null;
          if (reportMatchFailures) {
            matchFailed("\"a\"");
          }
        }
        if (result11 !== null) {
          var result0 = result11;
        } else {
          if (input.substr(pos, 1) === "b") {
            var result10 = "b";
            pos += 1;
          } else {
            var result10 = null;
            if (reportMatchFailures) {
              matchFailed("\"b\"");
            }
          }
          if (result10 !== null) {
            var result0 = result10;
          } else {
            if (input.substr(pos, 1) === "f") {
              var result9 = "f";
              pos += 1;
            } else {
              var result9 = null;
              if (reportMatchFailures) {
                matchFailed("\"f\"");
              }
            }
            if (result9 !== null) {
              var result0 = result9;
            } else {
              if (input.substr(pos, 1) === "n") {
                var result8 = "n";
                pos += 1;
              } else {
                var result8 = null;
                if (reportMatchFailures) {
                  matchFailed("\"n\"");
                }
              }
              if (result8 !== null) {
                var result0 = result8;
              } else {
                if (input.substr(pos, 1) === "r") {
                  var result7 = "r";
                  pos += 1;
                } else {
                  var result7 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"r\"");
                  }
                }
                if (result7 !== null) {
                  var result0 = result7;
                } else {
                  if (input.substr(pos, 1) === "t") {
                    var result6 = "t";
                    pos += 1;
                  } else {
                    var result6 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"t\"");
                    }
                  }
                  if (result6 !== null) {
                    var result0 = result6;
                  } else {
                    if (input.substr(pos, 1) === "v") {
                      var result5 = "v";
                      pos += 1;
                    } else {
                      var result5 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"v\"");
                      }
                    }
                    if (result5 !== null) {
                      var result0 = result5;
                    } else {
                      if (input.substr(pos, 1) === "\\") {
                        var result4 = "\\";
                        pos += 1;
                      } else {
                        var result4 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"\\\\\"");
                        }
                      }
                      if (result4 !== null) {
                        var result0 = result4;
                      } else {
                        if (input.substr(pos, 1) === "\"") {
                          var result3 = "\"";
                          pos += 1;
                        } else {
                          var result3 = null;
                          if (reportMatchFailures) {
                            matchFailed("\"\\\"\"");
                          }
                        }
                        if (result3 !== null) {
                          var result0 = result3;
                        } else {
                          if (input.substr(pos, 1) === "'") {
                            var result2 = "'";
                            pos += 1;
                          } else {
                            var result2 = null;
                            if (reportMatchFailures) {
                              matchFailed("\"'\"");
                            }
                          }
                          if (result2 !== null) {
                            var result0 = result2;
                          } else {
                            if (input.substr(pos, 1) === "&") {
                              var result1 = "&";
                              pos += 1;
                            } else {
                              var result1 = null;
                              if (reportMatchFailures) {
                                matchFailed("\"&\"");
                              }
                            }
                            if (result1 !== null) {
                              var result0 = result1;
                            } else {
                              var result0 = null;;
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_ascii() {
        var cacheKey = 'ascii@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "^") {
          var result35 = "^";
          pos += 1;
        } else {
          var result35 = null;
          if (reportMatchFailures) {
            matchFailed("\"^\"");
          }
        }
        if (result35 !== null) {
          var result36 = parse_cntrl();
          if (result36 !== null) {
            if (input.substr(pos, 3) === "&#0") {
              var result37 = "&#0";
              pos += 3;
            } else {
              var result37 = null;
              if (reportMatchFailures) {
                matchFailed("\"&#0\"");
              }
            }
            if (result37 !== null) {
              var result34 = [result35, result36, result37];
            } else {
              var result34 = null;
              pos = savedPos0;
            }
          } else {
            var result34 = null;
            pos = savedPos0;
          }
        } else {
          var result34 = null;
          pos = savedPos0;
        }
        if (result34 !== null) {
          var result0 = result34;
        } else {
          if (input.substr(pos, 3) === "&#1") {
            var result33 = "&#1";
            pos += 3;
          } else {
            var result33 = null;
            if (reportMatchFailures) {
              matchFailed("\"&#1\"");
            }
          }
          if (result33 !== null) {
            var result0 = result33;
          } else {
            if (input.substr(pos, 3) === "&#2") {
              var result32 = "&#2";
              pos += 3;
            } else {
              var result32 = null;
              if (reportMatchFailures) {
                matchFailed("\"&#2\"");
              }
            }
            if (result32 !== null) {
              var result0 = result32;
            } else {
              if (input.substr(pos, 3) === "&#3") {
                var result31 = "&#3";
                pos += 3;
              } else {
                var result31 = null;
                if (reportMatchFailures) {
                  matchFailed("\"&#3\"");
                }
              }
              if (result31 !== null) {
                var result0 = result31;
              } else {
                if (input.substr(pos, 3) === "&#4") {
                  var result30 = "&#4";
                  pos += 3;
                } else {
                  var result30 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"&#4\"");
                  }
                }
                if (result30 !== null) {
                  var result0 = result30;
                } else {
                  if (input.substr(pos, 3) === "&#5") {
                    var result29 = "&#5";
                    pos += 3;
                  } else {
                    var result29 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"&#5\"");
                    }
                  }
                  if (result29 !== null) {
                    var result0 = result29;
                  } else {
                    if (input.substr(pos, 3) === "&#6") {
                      var result28 = "&#6";
                      pos += 3;
                    } else {
                      var result28 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"&#6\"");
                      }
                    }
                    if (result28 !== null) {
                      var result0 = result28;
                    } else {
                      if (input.substr(pos, 3) === "&#7") {
                        var result27 = "&#7";
                        pos += 3;
                      } else {
                        var result27 = null;
                        if (reportMatchFailures) {
                          matchFailed("\"&#7\"");
                        }
                      }
                      if (result27 !== null) {
                        var result0 = result27;
                      } else {
                        if (input.substr(pos, 3) === "&#8") {
                          var result26 = "&#8";
                          pos += 3;
                        } else {
                          var result26 = null;
                          if (reportMatchFailures) {
                            matchFailed("\"&#8\"");
                          }
                        }
                        if (result26 !== null) {
                          var result0 = result26;
                        } else {
                          if (input.substr(pos, 3) === "&#9") {
                            var result25 = "&#9";
                            pos += 3;
                          } else {
                            var result25 = null;
                            if (reportMatchFailures) {
                              matchFailed("\"&#9\"");
                            }
                          }
                          if (result25 !== null) {
                            var result0 = result25;
                          } else {
                            if (input.substr(pos, 4) === "&#10") {
                              var result24 = "&#10";
                              pos += 4;
                            } else {
                              var result24 = null;
                              if (reportMatchFailures) {
                                matchFailed("\"&#10\"");
                              }
                            }
                            if (result24 !== null) {
                              var result0 = result24;
                            } else {
                              if (input.substr(pos, 4) === "&#11") {
                                var result23 = "&#11";
                                pos += 4;
                              } else {
                                var result23 = null;
                                if (reportMatchFailures) {
                                  matchFailed("\"&#11\"");
                                }
                              }
                              if (result23 !== null) {
                                var result0 = result23;
                              } else {
                                if (input.substr(pos, 4) === "&#12") {
                                  var result22 = "&#12";
                                  pos += 4;
                                } else {
                                  var result22 = null;
                                  if (reportMatchFailures) {
                                    matchFailed("\"&#12\"");
                                  }
                                }
                                if (result22 !== null) {
                                  var result0 = result22;
                                } else {
                                  if (input.substr(pos, 4) === "&#13") {
                                    var result21 = "&#13";
                                    pos += 4;
                                  } else {
                                    var result21 = null;
                                    if (reportMatchFailures) {
                                      matchFailed("\"&#13\"");
                                    }
                                  }
                                  if (result21 !== null) {
                                    var result0 = result21;
                                  } else {
                                    if (input.substr(pos, 4) === "&#14") {
                                      var result20 = "&#14";
                                      pos += 4;
                                    } else {
                                      var result20 = null;
                                      if (reportMatchFailures) {
                                        matchFailed("\"&#14\"");
                                      }
                                    }
                                    if (result20 !== null) {
                                      var result0 = result20;
                                    } else {
                                      if (input.substr(pos, 4) === "&#15") {
                                        var result19 = "&#15";
                                        pos += 4;
                                      } else {
                                        var result19 = null;
                                        if (reportMatchFailures) {
                                          matchFailed("\"&#15\"");
                                        }
                                      }
                                      if (result19 !== null) {
                                        var result0 = result19;
                                      } else {
                                        if (input.substr(pos, 4) === "&#16") {
                                          var result18 = "&#16";
                                          pos += 4;
                                        } else {
                                          var result18 = null;
                                          if (reportMatchFailures) {
                                            matchFailed("\"&#16\"");
                                          }
                                        }
                                        if (result18 !== null) {
                                          var result0 = result18;
                                        } else {
                                          if (input.substr(pos, 4) === "&#17") {
                                            var result17 = "&#17";
                                            pos += 4;
                                          } else {
                                            var result17 = null;
                                            if (reportMatchFailures) {
                                              matchFailed("\"&#17\"");
                                            }
                                          }
                                          if (result17 !== null) {
                                            var result0 = result17;
                                          } else {
                                            if (input.substr(pos, 4) === "&#18") {
                                              var result16 = "&#18";
                                              pos += 4;
                                            } else {
                                              var result16 = null;
                                              if (reportMatchFailures) {
                                                matchFailed("\"&#18\"");
                                              }
                                            }
                                            if (result16 !== null) {
                                              var result0 = result16;
                                            } else {
                                              if (input.substr(pos, 4) === "&#19") {
                                                var result15 = "&#19";
                                                pos += 4;
                                              } else {
                                                var result15 = null;
                                                if (reportMatchFailures) {
                                                  matchFailed("\"&#19\"");
                                                }
                                              }
                                              if (result15 !== null) {
                                                var result0 = result15;
                                              } else {
                                                if (input.substr(pos, 4) === "&#20") {
                                                  var result14 = "&#20";
                                                  pos += 4;
                                                } else {
                                                  var result14 = null;
                                                  if (reportMatchFailures) {
                                                    matchFailed("\"&#20\"");
                                                  }
                                                }
                                                if (result14 !== null) {
                                                  var result0 = result14;
                                                } else {
                                                  if (input.substr(pos, 4) === "&#21") {
                                                    var result13 = "&#21";
                                                    pos += 4;
                                                  } else {
                                                    var result13 = null;
                                                    if (reportMatchFailures) {
                                                      matchFailed("\"&#21\"");
                                                    }
                                                  }
                                                  if (result13 !== null) {
                                                    var result0 = result13;
                                                  } else {
                                                    if (input.substr(pos, 4) === "&#22") {
                                                      var result12 = "&#22";
                                                      pos += 4;
                                                    } else {
                                                      var result12 = null;
                                                      if (reportMatchFailures) {
                                                        matchFailed("\"&#22\"");
                                                      }
                                                    }
                                                    if (result12 !== null) {
                                                      var result0 = result12;
                                                    } else {
                                                      if (input.substr(pos, 4) === "&#23") {
                                                        var result11 = "&#23";
                                                        pos += 4;
                                                      } else {
                                                        var result11 = null;
                                                        if (reportMatchFailures) {
                                                          matchFailed("\"&#23\"");
                                                        }
                                                      }
                                                      if (result11 !== null) {
                                                        var result0 = result11;
                                                      } else {
                                                        if (input.substr(pos, 4) === "&#24") {
                                                          var result10 = "&#24";
                                                          pos += 4;
                                                        } else {
                                                          var result10 = null;
                                                          if (reportMatchFailures) {
                                                            matchFailed("\"&#24\"");
                                                          }
                                                        }
                                                        if (result10 !== null) {
                                                          var result0 = result10;
                                                        } else {
                                                          if (input.substr(pos, 4) === "&#25") {
                                                            var result9 = "&#25";
                                                            pos += 4;
                                                          } else {
                                                            var result9 = null;
                                                            if (reportMatchFailures) {
                                                              matchFailed("\"&#25\"");
                                                            }
                                                          }
                                                          if (result9 !== null) {
                                                            var result0 = result9;
                                                          } else {
                                                            if (input.substr(pos, 4) === "&#26") {
                                                              var result8 = "&#26";
                                                              pos += 4;
                                                            } else {
                                                              var result8 = null;
                                                              if (reportMatchFailures) {
                                                                matchFailed("\"&#26\"");
                                                              }
                                                            }
                                                            if (result8 !== null) {
                                                              var result0 = result8;
                                                            } else {
                                                              if (input.substr(pos, 4) === "&#27") {
                                                                var result7 = "&#27";
                                                                pos += 4;
                                                              } else {
                                                                var result7 = null;
                                                                if (reportMatchFailures) {
                                                                  matchFailed("\"&#27\"");
                                                                }
                                                              }
                                                              if (result7 !== null) {
                                                                var result0 = result7;
                                                              } else {
                                                                if (input.substr(pos, 4) === "&#28") {
                                                                  var result6 = "&#28";
                                                                  pos += 4;
                                                                } else {
                                                                  var result6 = null;
                                                                  if (reportMatchFailures) {
                                                                    matchFailed("\"&#28\"");
                                                                  }
                                                                }
                                                                if (result6 !== null) {
                                                                  var result0 = result6;
                                                                } else {
                                                                  if (input.substr(pos, 4) === "&#29") {
                                                                    var result5 = "&#29";
                                                                    pos += 4;
                                                                  } else {
                                                                    var result5 = null;
                                                                    if (reportMatchFailures) {
                                                                      matchFailed("\"&#29\"");
                                                                    }
                                                                  }
                                                                  if (result5 !== null) {
                                                                    var result0 = result5;
                                                                  } else {
                                                                    if (input.substr(pos, 4) === "&#30") {
                                                                      var result4 = "&#30";
                                                                      pos += 4;
                                                                    } else {
                                                                      var result4 = null;
                                                                      if (reportMatchFailures) {
                                                                        matchFailed("\"&#30\"");
                                                                      }
                                                                    }
                                                                    if (result4 !== null) {
                                                                      var result0 = result4;
                                                                    } else {
                                                                      if (input.substr(pos, 4) === "&#31") {
                                                                        var result3 = "&#31";
                                                                        pos += 4;
                                                                      } else {
                                                                        var result3 = null;
                                                                        if (reportMatchFailures) {
                                                                          matchFailed("\"&#31\"");
                                                                        }
                                                                      }
                                                                      if (result3 !== null) {
                                                                        var result0 = result3;
                                                                      } else {
                                                                        if (input.substr(pos, 4) === "&#32") {
                                                                          var result2 = "&#32";
                                                                          pos += 4;
                                                                        } else {
                                                                          var result2 = null;
                                                                          if (reportMatchFailures) {
                                                                            matchFailed("\"&#32\"");
                                                                          }
                                                                        }
                                                                        if (result2 !== null) {
                                                                          var result0 = result2;
                                                                        } else {
                                                                          if (input.substr(pos, 5) === "&#127") {
                                                                            var result1 = "&#127";
                                                                            pos += 5;
                                                                          } else {
                                                                            var result1 = null;
                                                                            if (reportMatchFailures) {
                                                                              matchFailed("\"&#127\"");
                                                                            }
                                                                          }
                                                                          if (result1 !== null) {
                                                                            var result0 = result1;
                                                                          } else {
                                                                            var result0 = null;;
                                                                          };
                                                                        };
                                                                      };
                                                                    };
                                                                  };
                                                                };
                                                              };
                                                            };
                                                          };
                                                        };
                                                      };
                                                    };
                                                  };
                                                };
                                              };
                                            };
                                          };
                                        };
                                      };
                                    };
                                  };
                                };
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_cntrl() {
        var cacheKey = 'cntrl@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var result7 = parse_ascLarge();
        if (result7 !== null) {
          var result0 = result7;
        } else {
          if (input.substr(pos, 1) === "@") {
            var result6 = "@";
            pos += 1;
          } else {
            var result6 = null;
            if (reportMatchFailures) {
              matchFailed("\"@\"");
            }
          }
          if (result6 !== null) {
            var result0 = result6;
          } else {
            if (input.substr(pos, 1) === "[") {
              var result5 = "[";
              pos += 1;
            } else {
              var result5 = null;
              if (reportMatchFailures) {
                matchFailed("\"[\"");
              }
            }
            if (result5 !== null) {
              var result0 = result5;
            } else {
              if (input.substr(pos, 1) === "\\") {
                var result4 = "\\";
                pos += 1;
              } else {
                var result4 = null;
                if (reportMatchFailures) {
                  matchFailed("\"\\\\\"");
                }
              }
              if (result4 !== null) {
                var result0 = result4;
              } else {
                if (input.substr(pos, 1) === "]") {
                  var result3 = "]";
                  pos += 1;
                } else {
                  var result3 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"]\"");
                  }
                }
                if (result3 !== null) {
                  var result0 = result3;
                } else {
                  if (input.substr(pos, 1) === "^") {
                    var result2 = "^";
                    pos += 1;
                  } else {
                    var result2 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"^\"");
                    }
                  }
                  if (result2 !== null) {
                    var result0 = result2;
                  } else {
                    if (input.substr(pos, 1) === "_") {
                      var result1 = "_";
                      pos += 1;
                    } else {
                      var result1 = null;
                      if (reportMatchFailures) {
                        matchFailed("\"_\"");
                      }
                    }
                    if (result1 !== null) {
                      var result0 = result1;
                    } else {
                      var result0 = null;;
                    };
                  };
                };
              };
            };
          };
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function parse_gap() {
        var cacheKey = 'gap@' + pos;
        var cachedResult = cache[cacheKey];
        if (cachedResult) {
          pos = cachedResult.nextPos;
          return cachedResult.result;
        }
        
        
        var savedPos0 = pos;
        if (input.substr(pos, 1) === "\\") {
          var result1 = "\\";
          pos += 1;
        } else {
          var result1 = null;
          if (reportMatchFailures) {
            matchFailed("\"\\\\\"");
          }
        }
        if (result1 !== null) {
          var result4 = parse_whitechar();
          if (result4 !== null) {
            var result2 = [];
            while (result4 !== null) {
              result2.push(result4);
              var result4 = parse_whitechar();
            }
          } else {
            var result2 = null;
          }
          if (result2 !== null) {
            if (input.substr(pos, 1) === "\\") {
              var result3 = "\\";
              pos += 1;
            } else {
              var result3 = null;
              if (reportMatchFailures) {
                matchFailed("\"\\\\\"");
              }
            }
            if (result3 !== null) {
              var result0 = [result1, result2, result3];
            } else {
              var result0 = null;
              pos = savedPos0;
            }
          } else {
            var result0 = null;
            pos = savedPos0;
          }
        } else {
          var result0 = null;
          pos = savedPos0;
        }
        
        
        
        cache[cacheKey] = {
          nextPos: pos,
          result:  result0
        };
        return result0;
      }
      
      function buildErrorMessage() {
        function buildExpected(failuresExpected) {
          failuresExpected.sort();
          
          var lastFailure = null;
          var failuresExpectedUnique = [];
          for (var i = 0; i < failuresExpected.length; i++) {
            if (failuresExpected[i] !== lastFailure) {
              failuresExpectedUnique.push(failuresExpected[i]);
              lastFailure = failuresExpected[i];
            }
          }
          
          switch (failuresExpectedUnique.length) {
            case 0:
              return 'end of input';
            case 1:
              return failuresExpectedUnique[0];
            default:
              return failuresExpectedUnique.slice(0, failuresExpectedUnique.length - 1).join(', ')
                + ' or '
                + failuresExpectedUnique[failuresExpectedUnique.length - 1];
          }
        }
        
        var expected = buildExpected(rightmostMatchFailuresExpected);
        var actualPos = Math.max(pos, rightmostMatchFailuresPos);
        var actual = actualPos < input.length
          ? quote(input.charAt(actualPos))
          : 'end of input';
        
        return 'Expected ' + expected + ' but ' + actual + ' found.';
      }
      
      function computeErrorPosition() {
        /*
         * The first idea was to use |String.split| to break the input up to the
         * error position along newlines and derive the line and column from
         * there. However IE's |split| implementation is so broken that it was
         * enough to prevent it.
         */
        
        var line = 1;
        var column = 1;
        var seenCR = false;
        
        for (var i = 0; i <  rightmostMatchFailuresPos; i++) {
          var ch = input.charAt(i);
          if (ch === '\n') {
            if (!seenCR) { line++; }
            column = 1;
            seenCR = false;
          } else if (ch === '\r' | ch === '\u2028' || ch === '\u2029') {
            line++;
            column = 1;
            seenCR = true;
          } else {
            column++;
            seenCR = false;
          }
        }
        
        return { line: line, column: column };
      }
      
      function flatten(array){
          var flat = [];
          for (var i = 0, l = array.length; i < l; i++){
              var type = Object.prototype.toString.call(array[i]).split(' ').pop().split(']').shift().toLowerCase();
              if (type) { flat = flat.concat(/^(array|collection|arguments|object)$/.test(type) ? flatten(array[i]) : array[i]); }
          }
          return flat;
      }
      
      var result = parseFunctions[startRule]();
      
      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos === input.length|
       *    - |rightmostMatchFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos < input.length|
       *    - |rightmostMatchFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos === 0|
       *   - |rightmostMatchFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos !== input.length) {
        var errorPosition = computeErrorPosition();
        throw new this.SyntaxError(
          buildErrorMessage(),
          errorPosition.line,
          errorPosition.column
        );
      }
      
      return result;
    },
    
    /* Returns the parser source code. */
    toSource: function() { return this._source; }
  };
  
  /* Thrown when a parser encounters a syntax error. */
  
  result.SyntaxError = function(message, line, column) {
    this.name = 'SyntaxError';
    this.message = message;
    this.line = line;
    this.column = column;
  };
  
  result.SyntaxError.prototype = Error.prototype;
  
  return result;
})();


// --- src/Parser/preL.js ---
//require Parser/Lexeme.js



JSHC.Parser.preL = function(input) {
	var column = 1;
	var line = 1;
	var newBlock = false;
	var newLine = false;
	var result = [];
	
	var mkToken = function (tok, lin, col) {
	    var thing = new Token(tok.val,lin,col,tok.typ);
	    if (tok.qual !== undefined)
	        thing.qual = tok.qual;
	    return thing; 
	}
	
	//If the first lexeme of a module is not { or module, then it is preceded 
	//by {n} where n is the indentation of the lexeme
	if (input[0].val === "{" || input[0].val === "module"){
//        result.push(new Token(input[0].val,line,column,input[0].typ));
        result.push(mkToken(input[0],line,column));
	    column += input[0].val.length;
	} else if (isWhite(input[0].val)) {
	    var lim = countvalues(input[0].val, "\n");
	    if (lim) {
	        line += lim;
	        column = 1;
	    }
	    if (input[1].val !== "{" && input[1].val !== "module") {
	        newBlock = true;
	    } 
	    try {
	        column += howLongWS(input[0].val,column);
	    }
	    catch (err) {
	        //err.message.concat
	        alert("In program: \n\n" + JSHC.showAST(input));
	        throw err;
	    }
	} else {
	    result.push(new Ind(column, line, BLOCKIND()));
	    column += input[0].val.length;
//	    result.push(new Token(input[0].val,line,column,input[0].typ));
	    result.push(mkToken(input[0],line,column));
	}
    
	for (var i = 1; i < input.length; i++) {
		if (isWhite(input[i].val)) {
		//input[i] is whitespace
		    var rows = countvalues(input[i].val,"\n");
            line += rows; // increase line number by the number of newlines
			if (rows > 0) {
			//if there was a newline, reset column count and indicate that a
			//newLine token is needed.
			    column = 1; 
                newLine = true;
			} 
			try {
			    column += howLongWS(input[i].val,column);
			} catch (err) {
			    //err.message.concat
			    alert("In program: \n\n" + JSHC.showAST(input));
	            throw err;
			}
		} else {
		//input[i] is a lexeme
		    if (newBlock) {
                if (input[i].val !== "{" && input[i+1])
		            result.push(new Ind(column, line, BLOCKIND()));
		        newBlock = false;
		        newLine = false;
		    } else if (newLine) {
		        result.push(new Ind(column, line, ROWIND()));
		        newLine = false;
		    }
//		    result.push(new Token(input[i].val,line,column,input[i].typ));
            result.push(mkToken(input[i],line,column));
		    column += input[i].val.length;
		    if (input[i].val === "where" || 
		        input[i].val === "let" ||
		        input[i].val === "do" ||
		        input[i].val === "of") {
		        newBlock = true;
//		        document.writeln("<br> newblock was set because of " + input[i].val)
		    }
		        

		}
	}
	return result;
}

//boolean check whether input::String is Whitespace.
function isWhite(input) {
	var res;
	if (input instanceof Array) 
		res = input.match(/\s/);
	else
		res = input.match(/\s/);
	if (res) 
		return true;
	else
		return false;			
}

//compute how long a piece of whitespace is
function howLongWS(ws, indent) {
	var sum = 0;
	for (var i = 0; i < ws.length; i++) {
		var c = ws.charAt(i);
		switch (c) {
		case ' ':
			sum ++;
			break;
		case '\t':
			do {sum++;} while ((sum + indent)%8 != 1 );
			break;
	    case '\n':
	        sum = 0;
	        break;
	    case '\r'://ignore carriage return
	        break;
		default:
		    throw new Error("Whitespace contained something that is not a newline or tab! Erroneous character code: " + ws.charCodeAt(i) + "in string: " + ws);
		}
	}
	return sum;
}

//count the occurrences of que in arr
function countvalues(arr,que) {
var i = arr.length;
var j = 0;
while( i-- ) {
	if (arr[i] === que)
		j++;
}
return j;
}


// --- src/Parser/iterL.js ---
var iterL = function() {
    this.stack = []; //the stack of layout contexts
    this.input = []; //the list of tokens generated by tokenize.js, reversed
    this.emptyBlock = false; //sets whether the current block will be an empty block
    this.recent; //the last returned token
    this.previous; // the previously returned token
    this.yytext = ""; //contains the source text that represents the current token
    this.yylineno = 0; //contains the lineno of the current token
    this.yyleng = 0; //contains the indentation of the current token
    this.yyname = ""; //contains the name (token-type) of the current token
    this.pErr = false; //contains info on whether the parser has returned an error message
    this.hadAnError = false;
    var debugging = false;
    var troublemaker;
    if(debugging) this.debugArr = [];
    
    //set the lexer's input, required by the JISON scanner API
    this.setInput = function(inp) {
//        document.writeln("<p>lexer initiated: " + inp + "</p>")
        this.input = inp.reverse();
    }
    
    this.lex = function() {
//        document.writeln("<p>lexer called, last returned: " + this.recent + "<br>previously returned: " + this. previous + "</p>")
        if (this.hadAnError){
            this.hadAnError = false;
            this.pErr = false;            
            this.updRecent(troublemaker);
            return this.yyname;
           
        }
        var x = peek(this.input);
        if (this.emptyBlock)
            return (new Token("}",x.row,x.col,"}"));
        if (this.input.length <= 0) {
            if (this.stack.length <= 0) {
                this.updRecent(new Token("EOF",Number.POSITIVE_INFINITY,
                                Number.POSITIVE_INFINITY,"EOF"));
                return this.yyname;//TODO: what kind of message does parser want at EOF?
            } else {
                if (peek(this.stack) > 0) {
                    this.updRecent(new Token("}", Number.POSITIVE_INFINITY, 
                              Number.POSITIVE_INFINITY, "}"));
                    this.stack.pop();
                    return this.yyname;
                } else {
                    throw new Error("Error: Unmatched { at EOF!");
                }
            }
        }        
            
        //creative use of ternary op to somewhat emulate a pattern match over
        //an array of different Object types.
        var what = (x instanceof Ind && x.isBlock)? "BI":
               (x instanceof Ind && !x.isBlock)? "RI":
               (x instanceof Token && x.val == "{")? "OB":
               (x instanceof Token && x.val == "}")? "CB":
               (x instanceof Token)? "T":
               "ERR";
//        if (this.pErr) 
//            document.writeln("<p>lexer: pErr and token is: " + what);
        switch(what){
        
            //current element is BLOCKIND
            case "BI":
            //L ({n} : ts) [] = { : (L ts [n]) if n > 0 (Note 1)
                if (this.stack.length === 0) {
                    if (x.col > 0) {
                        this.input.pop();
                        this.stack.push(x.col);
                        this.updRecent(new Token("{",x.row,x.col,"{"));
                        return this.yyname;
                    } else {
                        throw new Error("Layout error at row " + x.row + ", col " + x.col);
                    }
            //L ({n} : ts) (m : ms) = { : (L ts (n : m : ms)) if n > m (Note 1)
                } else if (x.col > peek(this.stack)) {
                    this.stack.push(x.col);
                    this.input.pop();
                    this.updRecent(new Token("{",x.row,x.col,"{"));
                    return this.yyname;
            //L {fn} : ts) ms = { : } : (L (< n >: ts) ms) (Note 2)
                } else {
                    this.emptyBlock = true;
                    this.input.pop();
                    this.input.push(new Ind(x.col, x.row, ROWIND()));
                    this.updRecent(new Token("{",x.row,x.col,"{"));
                    return this.yyname;
                    //replace the BLOCKIND with a ROWIND
                }
            break;
            //current element is ROWIND
            case "RI":
            //L (< n >: ts) (m : ms) = ; : (L ts (m : ms)) if m = n
                if (this.stack.length > 0 && x.col === peek(this.stack)) {
                    this.input.pop();
                    this.updRecent(new Token(";",x.row,x.col,";"));
                    return this.yyname;
            //L (< n >: ts) (m : ms) = } : (L (< n >: ts) ms) if n < m
                } else if (this.stack.length > 0 && x.col < peek(this.stack)) {
                    this.stack.pop();
//                    this.input.pop();
                    this.updRecent(new Token("}",x.row,x.col,"}"));
                    return this.yyname;
            //L (< n >: ts) ms = L ts ms
                } else {
                    this.input.pop();
                    return this.lex();
                }
            break;
            //current element is a Token "{"
            case "OB":
            //L ({ : ts) ms = { : (L ts (0 : ms)) (Note 4)
                this.input.pop();
                this.stack.push(0);
                this.updRecent(x);
                return this.yyname;
            break;
            //current element is a Token "}"
            case "CB":
            //L (} : ts) (0 : ms) = } : (L ts ms) (Note 3)
                if (peek(this.stack) === 0) {
                    this.input.pop();
                    this.stack.pop();
                    this.updRecent(x);
                    return this.yyname;
                } else {
                    throw new Error("Layout error at row " + x.row + ", col " + x.col);
                }
            break;
            //current element is any other Token
            case "T":
            //L (t : ts) (m : ms) = } : (L (t : ts) ms) if m= = 0 and parse-error(t)
                if (this.stack.length > 0 && peek(this.stack) !== 0 && this.pErr) {
//                    document.writeln("<p>parseError alternative reached in lexer</p>");
                    this.stack.pop();
                    this.pErr = false;
                    this.hadAnError = true;
//                    document.writeln("<p>recent is now: " + this.recent + "</p>");
                    troublemaker = this.recent;
                    this.updRecent(new Token("}",x.row,x.col,"}"),"ERROR");
//                    document.writeln("<p>recent is now: " + this.recent + "</p>");
                    return this.yyname;
            //L (t : ts) ms = t : (L ts ms)
                } else {
                    this.input.pop();
                    this.updRecent(x);
                    return this.yyname;
                }
            break;
            //current element is something else
            case "ERR":
            break;
           
            default:
            throw new Error("Something is srsly wrong with var what.");
        }
    }
    
    this.parseError = function() {
//        document.writeln("<p>calling parseError from lexer. stack is: " + this.stack + "<br>");
        if (this.stack.length > 0 && peek(this.stack) !== 0) {
            this.pErr = true;
            if(debugging)console.log("calling parseError from lexer. stack is: " + this.stack + "\n" + "returning: true");
            return true;
        } else {
            if(debugging)console.log("calling parseError from lexer. stack is: " + this.stack + "\n" + "returning: false");
        return false;
        }
    }
    
    this.updRecent = function(token, sender) {
        if (token instanceof Token) {
//            document.writeln("<p>updating recent: " + token + "</p>");
            this.previous = this.recent;
            this.recent = token;
            this.yytext = token.val;
            this.yylineno = token.row;
            this.yyleng = token.val.length;
            this.yyname = token.typ;
            this.yylloc = {first_line: token.row, first_column: token.col, 
                           last_line: token.row, last_column: token.col + token.val.length};
            if(debugging)console.log("lexer returning token: " + this.recent + sender );
            if(debugging)this.debugArr.push(this.recent.val);
        } else {//TODO: replace alerts by proper error handling!
            throw new Error("There should be no elems not of type Token in input for lexer!");
        }
        
    }
}

function peek(arr){
    return arr[arr.length-1];
}


// --- src/Parser/JSHCparser.js ---
/* Jison generated parser */
var JSHCparser = (function(){
var parser = {trace: 
function trace() {
}
,
yy: {},
symbols_: {"error":2,"start_":3,"module_":4,"EOF":5,"module":6,"modid":7,"where":8,"body":9,"(":10,"exports":11,")":12,"{":13,"topdecls":14,"}":15,"topdecls_nonempty":16,";":17,"topdecl":18,"decl":19,"data":20,"simpletype":21,"=":22,"constrs":23,"impdecl":24,"decls":25,"list_decl_comma_1":26,"decl_fixity":27,"var":28,"rhs":29,"apats":30,"pat":31,"varop":32,"::":33,"type":34,",":35,"vars":36,"exp":37,"infixl":38,"literal":39,"op_list_1_comma":40,"infixr":41,"infix":42,"tycon":43,"tyvars":44,"|":45,"constr":46,"con":47,"atypes":48,"atype":49,"exports_inner":50,"export":51,"qvar":52,"qtycon":53,"..":54,"list_cname_0_comma":55,"import":56,"imports":57,"hiding":58,"list_import_1_comma":59,"import_a":60,"infixexp":61,"infixexpLR":62,"lexp":63,"qop":64,"-":65,"if":66,"then":67,"else":68,"fexp":69,"\\":70,"->":71,"case":72,"of":73,"alts":74,"let":75,"in":76,"aexp":77,"alt":78,"list_cname_1_comma":79,"cname":80,"gcon":81,"tuple":82,"listexp":83,"list_exp_1_comma":84,"[":85,"]":86,"qconid":87,"conid":88,"qvarop":89,"qconop":90,"op":91,"conop":92,"consym":93,"`":94,"qvarsym":95,"qvarid":96,"gconsym":97,"varsym":98,"varid":99,"tyvar":100,"qcon":101,"list_1_comma":102,":":103,"qconsym":104,"gtycon":105,"apptype":106,"lpat":107,"apat":108,"_":109,"tuple_pat":110,"pat_list_1_comma":111,"integer":112,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",6:"module",8:"where",10:"(",12:")",13:"{",15:"}",17:";",20:"data",22:"=",33:"::",35:",",38:"infixl",41:"infixr",42:"infix",45:"|",54:"..",56:"import",58:"hiding",65:"-",66:"if",67:"then",68:"else",70:"\\",71:"->",72:"case",73:"of",75:"let",76:"in",85:"[",86:"]",87:"qconid",88:"conid",93:"consym",94:"`",95:"qvarsym",96:"qvarid",98:"varsym",99:"varid",103:":",104:"qconsym",109:"_",112:"integer"},
productions_: [0,[3,2],[4,4],[4,7],[4,1],[9,3],[9,0],[14,1],[16,3],[16,1],[18,1],[18,2],[18,4],[18,1],[25,2],[25,3],[25,3],[25,4],[26,3],[26,1],[19,1],[19,2],[19,3],[19,4],[19,7],[19,3],[19,5],[29,2],[29,4],[27,3],[27,3],[27,3],[21,1],[21,2],[23,3],[23,1],[46,1],[46,2],[48,2],[48,1],[11,1],[11,2],[50,3],[50,1],[51,1],[51,2],[51,1],[51,4],[51,4],[24,2],[24,5],[24,6],[57,1],[57,2],[57,1],[57,0],[59,3],[59,1],[60,1],[60,1],[60,4],[60,4],[37,3],[37,1],[61,2],[62,3],[62,2],[62,0],[63,6],[63,1],[63,4],[63,6],[63,4],[69,1],[69,2],[36,3],[36,1],[74,3],[74,1],[78,3],[55,1],[55,0],[79,3],[79,1],[80,1],[77,1],[77,1],[77,1],[77,3],[77,1],[77,1],[82,5],[83,3],[84,3],[84,1],[7,1],[7,1],[64,1],[64,1],[40,3],[40,1],[91,1],[91,1],[92,1],[92,3],[89,1],[89,1],[89,3],[90,1],[90,3],[32,1],[32,3],[44,2],[44,1],[100,1],[43,1],[53,1],[53,1],[47,1],[47,3],[101,1],[101,3],[101,1],[81,2],[81,2],[81,3],[81,1],[102,1],[102,2],[28,1],[28,3],[52,1],[52,3],[52,1],[97,1],[97,1],[49,1],[49,1],[49,3],[34,1],[34,3],[106,2],[106,1],[105,1],[31,1],[107,1],[107,2],[30,1],[30,2],[108,1],[108,1],[108,1],[108,1],[108,1],[108,3],[110,5],[111,3],[111,1],[39,1]],
performAction: 
function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$) {
    var $0 = $$.length - 1;
    switch (yystate) {
      case 1:
        return $$[$0 - 1];
        break;
      case 2:
        this.$ = {name:"module", modid:$$[$0 - 2], body:$$[$0], pos:this._$};
        break;
      case 3:
        this.$ = {name:"module", modid:$$[$0 - 5], exports:$$[$0 - 3], body:$$[$0], pos:this._$};
        break;
      case 4:
        this.$ = {name:"module", modid:new JSHC.ModName("Main"), body:$$[$0], pos:this._$};
        break;
      case 5:
        var imps = [], decs = [], atdecs = false;
        for (var i = 0; i < $$[$0 - 1].length; i++) {
            if ($$[$0 - 1][i].name == "impdecl" && !atdecs) {
                imps.push($$[$0 - 1][i]);
            } else {
                if ($$[$0 - 1][i].name == "impdecl" && atdecs) {
                    throw new JSHC.ParseError("import declaration in statement block at line " + $$[$0 - 1][i].pos.first_line, $$[$0 - 1][i].pos, "import declaration in statement block");
                } else {
                    atdecs = true;
                    decs.push($$[$0 - 1][i]);
                }
            }
        }
        var prelude_imported = false;
        for (i = 0; i < imps.length; i++) {
            if (imps[i].modid == "Prelude") {
                prelude_imported = true;
                break;
            }
        }
        if (!prelude_imported) {
            imps.push({name:"impdecl", modid:new JSHC.ModName("Prelude")});
        }
        this.$ = {name:"body", impdecls:imps, topdecls:decs, pos:this._$};
        break;
      case 6:
        this.$ = {name:"body", impdecls:[], topdecls:[], pos:this._$};
        break;
      case 7:
        this.$ = $$[$0];
        break;
      case 8:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 9:
        this.$ = [$$[$0]];
        break;
      case 10:
        this.$ = {name:"topdecl-decl", decl:$$[$0], pos:this._$};
        break;
      case 11:
        this.$ = {name:"topdecl-data", typ:$$[$0], constrs:[], pos:this._$};
        break;
      case 12:
        this.$ = {name:"topdecl-data", typ:$$[$0 - 2], constrs:$$[$0], pos:this._$};
        break;
      case 13:
        this.$ = $$[$0];
        break;
      case 14:
        this.$ = [];
        break;
      case 15:
        this.$ = $$[$0 - 1];
        break;
      case 16:
        this.$ = [];
        break;
      case 17:
        this.$ = $$[$0 - 2];
        break;
      case 18:
        ($$[$0 - 2]).push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 19:
        this.$ = [$$[$0]];
        break;
      case 20:
        this.$ = $$[$0];
        break;
      case 21:
        this.$ = {name:"decl-fun", ident:$$[$0 - 1], args:[], rhs:$$[$0], pos:this._$};
        break;
      case 22:
        this.$ = {name:"decl-fun", ident:$$[$0 - 2], args:$$[$0 - 1], rhs:$$[$0], pos:this._$};
        break;
      case 23:
        this.$ = {name:"decl-fun", ident:$$[$0 - 2], args:[$$[$0 - 3], $$[$0 - 1]], rhs:$$[$0], pos:this._$, orig:"infix"};
        break;
      case 24:
        this.$ = {name:"decl-fun", ident:$$[$0 - 4], args:[$$[$0 - 5], $$[$0 - 3]].concat($$[$0 - 1]), rhs:$$[$0], pos:this._$, orig:"infix"};
        break;
      case 25:
        this.$ = {name:"type-signature", vars:[$$[$0 - 2]], sig:$$[$0], pos:this._$};
        break;
      case 26:
        this.$ = {name:"type-signature", vars:[$$[$0 - 4]].concat($$[$0 - 2]), sig:$$[$0], pos:this._$};
        break;
      case 27:
        this.$ = $$[$0];
        break;
      case 28:
        this.$ = {name:"fun-where", exp:$$[$0 - 2], decls:$$[$0], pos:this._$};
        break;
      case 29:
        this.$ = {name:"fixity", fix:"leftfix", num:$$[$0 - 1], ops:$$[$0], pos:this._$};
        break;
      case 30:
        this.$ = {name:"fixity", fix:"rightfix", num:$$[$0 - 1], ops:$$[$0], pos:this._$};
        break;
      case 31:
        this.$ = {name:"fixity", fix:"nonfix", num:$$[$0 - 1], ops:$$[$0], pos:this._$};
        break;
      case 32:
        this.$ = {name:"simpletype", tycon:$$[$0], vars:[], pos:this._$};
        break;
      case 33:
        this.$ = {name:"simpletype", tycon:$$[$0 - 1], vars:$$[$0], pos:this._$};
        break;
      case 34:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 35:
        this.$ = [$$[$0]];
        break;
      case 36:
        this.$ = {name:"constr", dacon:$$[$0], types:[], pos:this._$};
        break;
      case 37:
        this.$ = {name:"constr", dacon:$$[$0 - 1], types:$$[$0], pos:this._$};
        break;
      case 38:
        $$[$0 - 1].push($$[$0]);
        this.$ = $$[$0 - 1];
        break;
      case 39:
        this.$ = [$$[$0]];
        break;
      case 40:
        this.$ = $$[$0];
        break;
      case 41:
        this.$ = $$[$0 - 1];
        break;
      case 42:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 43:
        this.$ = [$$[$0]];
        break;
      case 44:
        this.$ = {name:"export-qvar", exp:$$[$0], pos:this._$};
        break;
      case 45:
        this.$ = {name:"export-module", exp:$$[$0], pos:this._$};
        break;
      case 46:
        this.$ = {name:"export-type-unspec", exp:$$[$0], pos:this._$};
        break;
      case 47:
        this.$ = {name:"export-type-all", exp:$$[$0 - 3], pos:this._$};
        break;
      case 48:
        this.$ = {name:"export-type-vars", exp:$$[$0 - 3], vars:$$[$0 - 1], pos:this._$};
        break;
      case 49:
        this.$ = {name:"impdecl", modid:$$[$0], pos:this._$};
        break;
      case 50:
        this.$ = {name:"impdecl", modid:$$[$0 - 3], hiding:false, imports:$$[$0 - 1], pos:this._$};
        break;
      case 51:
        this.$ = {name:"impdecl", modid:$$[$0 - 4], hiding:true, imports:$$[$0 - 1], pos:this._$};
        break;
      case 52:
        this.$ = $$[$0];
        break;
      case 53:
        this.$ = $$[$0 - 1];
        break;
      case 54:
        this.$ = [];
        break;
      case 55:
        this.$ = [];
        break;
      case 56:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 57:
        this.$ = [$$[$0]];
        break;
      case 58:
        this.$ = {name:"import-var", varname:$$[$0], pos:this._$};
        break;
      case 59:
        this.$ = {name:"import-tycon", tycon:$$[$0], all:false, pos:this._$};
        break;
      case 60:
        this.$ = {name:"import-tycon", tycon:$$[$0 - 3], all:true, pos:this._$};
        break;
      case 61:
        this.$ = {name:"import-tycon", tycon:$$[$0 - 3], all:false, list:$$[$0 - 1], pos:this._$};
        break;
      case 62:
        this.$ = {name:"type-signature", exp:$$[$0 - 2], sig:$$[$0], pos:this._$};
        break;
      case 63:
        this.$ = $$[$0];
        break;
      case 64:
        ($$[$0 - 1]).push($$[$0]);
        if (($$[$0 - 1]).length == 1 && ($$[$0 - 1])[0].name == "infixexp") {
            this.$ = ($$[$0 - 1])[0];
        } else {
            this.$ = {name:"infixexp", exps:$$[$0 - 1], pos:this._$};
        }
        break;
      case 65:
        ($$[$0 - 2]).push($$[$0 - 1], $$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 66:
        ($$[$0 - 1]).push($$[$0]);
        this.$ = $$[$0];
        break;
      case 67:
        this.$ = [];
        break;
      case 68:
        this.$ = {name:"ite", e1:$$[$0 - 4], e2:$$[$0 - 2], e3:$$[$0], pos:this._$};
        break;
      case 69:
        this.$ = ($$[$0].length === 1) ? ($$[$0][0]) : {name:"application", exps:$$[$0], pos:this._$};
        break;
      case 70:
        this.$ = {name:"lambda", args:$$[$0 - 2], rhs:$$[$0], pos:this._$};
        break;
      case 71:
        this.$ = {name:"case", exp:$$[$0 - 4], alts:$$[$0 - 1], pos:this._$};
        break;
      case 72:
        this.$ = {name:"let", decls:$$[$0 - 2], exp:$$[$0], pos:this._$};
        break;
      case 73:
        this.$ = [$$[$0]];
        break;
      case 74:
        ($$[$0 - 1]).push($$[$0]);
        this.$ = $$[$0 - 1];
        break;
      case 75:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 76:
        this.$ = [$$[$0]];
        break;
      case 77:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 78:
        this.$ = [$$[$0]];
        break;
      case 79:
        this.$ = {name:"alt", pat:$$[$0 - 2], exp:$$[$0]};
        break;
      case 80:
        this.$ = $$[$0];
        break;
      case 81:
        this.$ = [];
        break;
      case 82:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 83:
        this.$ = [$$[$0]];
        break;
      case 84:
        this.$ = $$[$0];
        break;
      case 85:
        this.$ = $$[$0];
        break;
      case 86:
        this.$ = $$[$0];
        break;
      case 87:
        this.$ = $$[$0];
        break;
      case 88:
        this.$ = $$[$0 - 1];
        break;
      case 89:
        this.$ = $$[$0];
        break;
      case 90:
        this.$ = $$[$0];
        break;
      case 91:
        $$[$0 - 1].unshift($$[$0 - 3]);
        this.$ = {name:"tuple", members:$$[$0 - 1], pos:this._$};
        break;
      case 92:
        this.$ = {name:"listexp", members:$$[$0 - 1], pos:this._$};
        break;
      case 93:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 94:
        this.$ = [$$[$0]];
        break;
      case 95:
        this.$ = new JSHC.ModName($$[$0], this._$, yy.lexer.previous.qual);
        break;
      case 96:
        this.$ = new JSHC.ModName($$[$0], this._$);
        break;
      case 97:
        this.$ = {name:"qop", id:$$[$0], pos:this._$};
        break;
      case 98:
        this.$ = {name:"qop", id:$$[$0], pos:this._$};
        break;
      case 99:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 100:
        this.$ = [$$[$0]];
        break;
      case 101:
        this.$ = $$[$0];
        break;
      case 102:
        this.$ = $$[$0];
        break;
      case 103:
        this.$ = new JSHC.DaCon($$[$0], this._$, true);
        break;
      case 104:
        this.$ = new JSHC.DaCon($$[$0 - 1], this._$, false);
        break;
      case 105:
        this.$ = new JSHC.VarName($$[$0], this._$, true, yy.lexer.previous.qual);
        break;
      case 106:
        this.$ = $$[$0];
        break;
      case 107:
        this.$ = new JSHC.VarName($$[$0 - 1], this._$, false, yy.lexer.previous.qual);
        break;
      case 108:
        this.$ = $$[$0];
        break;
      case 109:
        this.$ = new JSHC.DaCon($$[$0 - 1], this._$, false, yy.lexer.previous.qual);
        break;
      case 110:
        this.$ = new JSHC.VarName($$[$0], this._$, true);
        break;
      case 111:
        this.$ = new JSHC.VarName($$[$0 - 1], this._$, false);
        break;
      case 112:
        $$[$0 - 1].push($$[$0]);
        this.$ = $$[$0 - 1];
        break;
      case 113:
        this.$ = [$$[$0]];
        break;
      case 114:
        this.$ = new JSHC.TyVar($$[$0], this._$);
        break;
      case 115:
        this.$ = new JSHC.TyCon($$[$0], this._$);
        break;
      case 116:
        this.$ = new JSHC.TyCon($$[$0], this._$, yy.lexer.previous.qual);
        break;
      case 117:
        this.$ = $$[$0];
        break;
      case 118:
        this.$ = new JSHC.DaCon($$[$0], this._$, false);
        break;
      case 119:
        this.$ = new JSHC.DaCon($$[$0 - 1], this._$, true);
        break;
      case 120:
        this.$ = new JSHC.DaCon($$[$0], this._$, false, yy.lexer.previous.qual);
        break;
      case 121:
        this.$ = $$[$0 - 1];
        break;
      case 122:
        this.$ = $$[$0];
        break;
      case 123:
        this.$ = new JSHC.UnitDaCon(this._$);
        break;
      case 124:
        this.$ = new JSHC.NilDaCon(this._$);
        break;
      case 125:
        this.$ = new JSHC.TupleDaCon($$[$0 - 1] + 1, this._$);
        break;
      case 126:
        this.$ = $$[$0];
        break;
      case 127:
        this.$ = 1;
        break;
      case 128:
        this.$ = $$[$0 - 1] + 1;
        break;
      case 129:
        this.$ = new JSHC.VarName($$[$0], this._$, false);
        break;
      case 130:
        this.$ = new JSHC.VarName($$[$0 - 1], this._$, true);
        break;
      case 131:
        this.$ = new JSHC.VarName($$[$0], this._$, false, yy.lexer.previous.qual);
        break;
      case 132:
        this.$ = new JSHC.VarName($$[$0 - 1], this._$, true, yy.lexer.previous.qual);
        break;
      case 133:
        this.$ = $$[$0];
        break;
      case 134:
        this.$ = new JSHC.ConsDaCon(this._$);
        break;
      case 135:
        this.$ = new JSHC.DaCon($$[$0], this._$, true, yy.lexer.previous.qual);
        break;
      case 136:
        this.$ = $$[$0];
        break;
      case 137:
        this.$ = $$[$0];
        break;
      case 138:
        this.$ = $$[$0 - 1];
        break;
      case 139:
        this.$ = $$[$0];
        break;
      case 140:
        this.$ = new JSHC.FunType([$$[$0 - 2], $$[$0]], this._$);
        break;
      case 141:
        this.$ = new JSHC.AppType($$[$0 - 1], $$[$0], this._$);
        break;
      case 142:
        this.$ = $$[$0];
        break;
      case 143:
        this.$ = $$[$0];
        break;
      case 144:
        this.$ = $$[$0];
        break;
      case 145:
        this.$ = $$[$0];
        break;
      case 146:
        this.$ = {name:"conpat", con:$$[$0 - 1], pats:$$[$0]};
        break;
      case 147:
        this.$ = [$$[$0]];
        break;
      case 148:
        $$[$0 - 1].push($$[$0]);
        this.$ = $$[$0 - 1];
        break;
      case 149:
        this.$ = $$[$0];
        break;
      case 150:
        this.$ = $$[$0];
        break;
      case 151:
        this.$ = $$[$0];
        break;
      case 152:
        this.$ = {name:"wildcard", pos:this._$};
        break;
      case 153:
        this.$ = $$[$0];
        break;
      case 154:
        this.$ = $$[$0 - 1];
        break;
      case 155:
        $$[$0 - 1].unshift($$[$0 - 3]);
        this.$ = {name:"tuple_pat", members:$$[$0 - 1], pos:this._$};
        break;
      case 156:
        $$[$0 - 2].push($$[$0]);
        this.$ = $$[$0 - 2];
        break;
      case 157:
        this.$ = [$$[$0]];
        break;
      case 158:
        this.$ = {name:"integer-lit", value:Number($$[$0]), pos:this._$};
        break;
    }
}
,
table: [{3:1,4:2,6:[1,3],9:4,13:[1,5],5:[2,6]},{1:[3]},{5:[1,6]},{7:7,87:[1,8],88:[1,9]},{5:[2,4]},{14:10,16:11,18:12,19:13,20:[1,14],24:15,27:16,28:17,31:18,10:[1,19],56:[1,20],38:[1,21],41:[1,22],42:[1,23],99:[1,24],107:25,108:26,81:27,39:28,109:[1,29],110:30,85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{1:[2,1]},{8:[1,37],10:[1,38]},{8:[2,95],10:[2,95],17:[2,95],15:[2,95],58:[2,95],12:[2,95],35:[2,95]},{8:[2,96],10:[2,96],17:[2,96],15:[2,96],58:[2,96],12:[2,96],35:[2,96]},{15:[1,39]},{17:[1,40],15:[2,7]},{15:[2,9],17:[2,9]},{17:[2,10],15:[2,10]},{21:41,43:42,88:[1,43]},{17:[2,13],15:[2,13]},{15:[2,20],17:[2,20],2:[2,20]},{29:44,30:45,33:[1,46],35:[1,47],22:[1,48],108:49,28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36],98:[2,149],94:[2,149]},{32:53,98:[1,54],94:[1,55]},{31:56,98:[1,57],12:[1,58],102:59,97:60,93:[1,61],107:25,35:[1,62],103:[1,63],104:[1,64],108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{7:65,87:[1,8],88:[1,9]},{39:66,112:[1,33]},{39:67,112:[1,33]},{39:68,112:[1,33]},{22:[2,129],99:[2,129],10:[2,129],85:[2,129],87:[2,129],88:[2,129],112:[2,129],109:[2,129],33:[2,129],35:[2,129],94:[2,129],98:[2,129],12:[2,129],71:[2,129],15:[2,129],17:[2,129],8:[2,129],95:[2,129],103:[2,129],104:[2,129],67:[2,129],73:[2,129],86:[2,129],68:[2,129],2:[2,129],96:[2,129]},{98:[2,144],94:[2,144],12:[2,144],35:[2,144],22:[2,144],71:[2,144]},{94:[2,145],98:[2,145],35:[2,145],12:[2,145],22:[2,145],71:[2,145]},{30:69,108:49,28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36],98:[2,150],94:[2,150],12:[2,150],35:[2,150],22:[2,150],71:[2,150]},{98:[2,151],94:[2,151],22:[2,151],109:[2,151],112:[2,151],88:[2,151],87:[2,151],85:[2,151],10:[2,151],99:[2,151],12:[2,151],35:[2,151],71:[2,151]},{98:[2,152],94:[2,152],22:[2,152],109:[2,152],112:[2,152],88:[2,152],87:[2,152],85:[2,152],10:[2,152],99:[2,152],12:[2,152],35:[2,152],71:[2,152]},{98:[2,153],94:[2,153],22:[2,153],109:[2,153],112:[2,153],88:[2,153],87:[2,153],85:[2,153],10:[2,153],99:[2,153],12:[2,153],35:[2,153],71:[2,153]},{86:[1,70]},{99:[2,126],10:[2,126],85:[2,126],87:[2,126],88:[2,126],112:[2,126],109:[2,126],94:[2,126],98:[2,126],22:[2,126],35:[2,126],12:[2,126],71:[2,126],104:[2,126],103:[2,126],95:[2,126],33:[2,126],8:[2,126],17:[2,126],15:[2,126],96:[2,126],2:[2,126],68:[2,126],86:[2,126],73:[2,126],67:[2,126]},{94:[2,158],98:[2,158],22:[2,158],99:[2,158],10:[2,158],85:[2,158],87:[2,158],88:[2,158],112:[2,158],109:[2,158],35:[2,158],12:[2,158],93:[2,158],71:[2,158],104:[2,158],103:[2,158],95:[2,158],33:[2,158],8:[2,158],17:[2,158],15:[2,158],96:[2,158],2:[2,158],68:[2,158],86:[2,158],73:[2,158],67:[2,158]},{98:[2,120],94:[2,120],109:[2,120],112:[2,120],88:[2,120],87:[2,120],85:[2,120],10:[2,120],99:[2,120],22:[2,120],12:[2,120],35:[2,120],71:[2,120],15:[2,120],17:[2,120],8:[2,120],33:[2,120],95:[2,120],103:[2,120],104:[2,120],67:[2,120],73:[2,120],86:[2,120],68:[2,120],2:[2,120],96:[2,120]},{98:[2,122],94:[2,122],109:[2,122],112:[2,122],88:[2,122],87:[2,122],85:[2,122],10:[2,122],99:[2,122],22:[2,122],12:[2,122],35:[2,122],71:[2,122],15:[2,122],17:[2,122],8:[2,122],33:[2,122],95:[2,122],103:[2,122],104:[2,122],67:[2,122],73:[2,122],86:[2,122],68:[2,122],2:[2,122],96:[2,122]},{99:[2,118],10:[2,118],85:[2,118],87:[2,118],88:[2,118],112:[2,118],109:[2,118],94:[2,118],98:[2,118],22:[2,118],35:[2,118],12:[2,118],71:[2,118],15:[2,118],17:[2,118],45:[2,118],104:[2,118],103:[2,118],95:[2,118],33:[2,118],8:[2,118],96:[2,118],2:[2,118],68:[2,118],86:[2,118],73:[2,118],67:[2,118]},{9:71,13:[1,5],5:[2,6]},{11:72,50:73,51:74,52:75,6:[1,76],53:77,96:[1,78],10:[1,79],28:80,87:[1,81],43:82,99:[1,24],88:[1,43]},{5:[2,5]},{18:83,19:13,20:[1,14],24:15,27:16,28:17,31:18,10:[1,19],56:[1,20],38:[1,21],41:[1,22],42:[1,23],99:[1,24],107:25,108:26,81:27,39:28,109:[1,29],110:30,85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{22:[1,84],17:[2,11],15:[2,11]},{44:85,100:86,99:[1,87],15:[2,32],17:[2,32],22:[2,32]},{22:[2,115],17:[2,115],15:[2,115],99:[2,115],10:[2,115],35:[2,115],12:[2,115],71:[2,115],87:[2,115],88:[2,115],2:[2,115],8:[2,115],104:[2,115],103:[2,115],94:[2,115],98:[2,115],95:[2,115],33:[2,115],68:[2,115],86:[2,115],73:[2,115],67:[2,115],45:[2,115]},{15:[2,21],17:[2,21],2:[2,21]},{29:88,108:89,22:[1,48],28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{34:90,106:91,49:92,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43]},{36:97,28:98,99:[1,24],10:[1,99]},{37:100,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{22:[2,147],99:[2,147],10:[2,147],85:[2,147],87:[2,147],88:[2,147],112:[2,147],109:[2,147],98:[2,147],94:[2,147],12:[2,147],35:[2,147],71:[2,147]},{22:[2,149],109:[2,149],112:[2,149],88:[2,149],87:[2,149],85:[2,149],10:[2,149],99:[2,149],98:[2,149],94:[2,149],12:[2,149],35:[2,149],71:[2,149]},{22:[2,150],109:[2,150],112:[2,150],88:[2,150],87:[2,150],85:[2,150],10:[2,150],99:[2,150],35:[2,150],12:[2,150],94:[2,150],98:[2,150],71:[2,150]},{31:103,98:[1,57],12:[1,58],102:59,97:60,93:[1,61],107:25,35:[1,62],103:[1,63],104:[1,64],108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{31:104,107:25,108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{99:[2,110],10:[2,110],85:[2,110],87:[2,110],112:[2,110],109:[2,110],88:[2,110],15:[2,110],17:[2,110],35:[2,110],2:[2,110],75:[2,110],72:[2,110],70:[2,110],96:[2,110],66:[2,110],65:[2,110]},{99:[1,105]},{32:106,12:[1,107],35:[1,108],98:[1,54],94:[1,55]},{12:[1,109]},{99:[2,123],10:[2,123],85:[2,123],87:[2,123],88:[2,123],112:[2,123],109:[2,123],94:[2,123],98:[2,123],22:[2,123],35:[2,123],12:[2,123],71:[2,123],104:[2,123],103:[2,123],95:[2,123],33:[2,123],8:[2,123],17:[2,123],15:[2,123],96:[2,123],2:[2,123],68:[2,123],86:[2,123],73:[2,123],67:[2,123]},{12:[1,110],35:[1,111]},{12:[1,112]},{12:[1,113]},{12:[2,127],35:[2,127]},{12:[2,134],75:[2,134],72:[2,134],70:[2,134],112:[2,134],88:[2,134],87:[2,134],85:[2,134],99:[2,134],10:[2,134],96:[2,134],66:[2,134],65:[2,134]},{12:[2,135],75:[2,135],72:[2,135],70:[2,135],112:[2,135],88:[2,135],87:[2,135],85:[2,135],99:[2,135],10:[2,135],96:[2,135],66:[2,135],65:[2,135]},{10:[1,114],58:[1,115],15:[2,49],17:[2,49]},{40:116,91:117,32:118,92:119,98:[1,54],94:[1,120],93:[1,121]},{40:122,91:117,32:118,92:119,98:[1,54],94:[1,120],93:[1,121]},{40:123,91:117,32:118,92:119,98:[1,54],94:[1,120],93:[1,121]},{108:89,28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36],94:[2,146],98:[2,146],35:[2,146],12:[2,146],22:[2,146],71:[2,146]},{99:[2,124],10:[2,124],85:[2,124],87:[2,124],88:[2,124],112:[2,124],109:[2,124],94:[2,124],98:[2,124],22:[2,124],35:[2,124],12:[2,124],71:[2,124],104:[2,124],103:[2,124],95:[2,124],33:[2,124],8:[2,124],17:[2,124],15:[2,124],96:[2,124],2:[2,124],68:[2,124],86:[2,124],73:[2,124],67:[2,124]},{5:[2,2]},{12:[1,124]},{35:[1,125],12:[2,40]},{12:[2,43],35:[2,43]},{35:[2,44],12:[2,44]},{7:126,87:[1,8],88:[1,9]},{10:[1,127],35:[2,46],12:[2,46]},{12:[2,131],35:[2,131],104:[2,131],103:[2,131],94:[2,131],98:[2,131],95:[2,131],33:[2,131],8:[2,131],17:[2,131],15:[2,131],96:[2,131],10:[2,131],99:[2,131],85:[2,131],87:[2,131],88:[2,131],112:[2,131],2:[2,131],68:[2,131],86:[2,131],73:[2,131],67:[2,131]},{95:[1,128],98:[1,57]},{12:[2,133],35:[2,133],104:[2,133],103:[2,133],94:[2,133],98:[2,133],95:[2,133],33:[2,133],8:[2,133],17:[2,133],15:[2,133],96:[2,133],10:[2,133],99:[2,133],85:[2,133],87:[2,133],88:[2,133],112:[2,133],2:[2,133],68:[2,133],86:[2,133],73:[2,133],67:[2,133]},{12:[2,116],35:[2,116],10:[2,116],99:[2,116],88:[2,116],87:[2,116],71:[2,116],17:[2,116],15:[2,116],2:[2,116],8:[2,116],67:[2,116],73:[2,116],86:[2,116],68:[2,116],33:[2,116],95:[2,116],98:[2,116],94:[2,116],103:[2,116],104:[2,116],45:[2,116]},{12:[2,117],35:[2,117],10:[2,117],99:[2,117],88:[2,117],87:[2,117],71:[2,117],17:[2,117],15:[2,117],2:[2,117],8:[2,117],67:[2,117],73:[2,117],86:[2,117],68:[2,117],33:[2,117],95:[2,117],98:[2,117],94:[2,117],103:[2,117],104:[2,117],45:[2,117]},{15:[2,8],17:[2,8]},{23:129,46:130,47:131,88:[1,36],10:[1,132]},{100:133,99:[1,87],15:[2,33],17:[2,33],22:[2,33]},{22:[2,113],17:[2,113],15:[2,113],99:[2,113]},{99:[2,114],15:[2,114],17:[2,114],22:[2,114],71:[2,114],87:[2,114],88:[2,114],10:[2,114],2:[2,114],8:[2,114],12:[2,114],35:[2,114],104:[2,114],103:[2,114],94:[2,114],98:[2,114],95:[2,114],33:[2,114],68:[2,114],86:[2,114],73:[2,114],67:[2,114],45:[2,114]},{15:[2,22],17:[2,22],2:[2,22]},{22:[2,148],99:[2,148],10:[2,148],85:[2,148],87:[2,148],88:[2,148],112:[2,148],109:[2,148],98:[2,148],94:[2,148],12:[2,148],35:[2,148],71:[2,148]},{15:[2,25],17:[2,25],2:[2,25]},{71:[1,134],49:135,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43],17:[2,139],15:[2,139],2:[2,139],12:[2,139],8:[2,139],35:[2,139],104:[2,139],103:[2,139],94:[2,139],98:[2,139],95:[2,139],33:[2,139],68:[2,139],86:[2,139],73:[2,139],67:[2,139]},{15:[2,142],17:[2,142],71:[2,142],87:[2,142],88:[2,142],99:[2,142],10:[2,142],2:[2,142],12:[2,142],8:[2,142],67:[2,142],73:[2,142],35:[2,142],86:[2,142],68:[2,142],33:[2,142],95:[2,142],98:[2,142],94:[2,142],103:[2,142],104:[2,142]},{10:[2,136],99:[2,136],88:[2,136],87:[2,136],71:[2,136],17:[2,136],15:[2,136],2:[2,136],12:[2,136],8:[2,136],67:[2,136],73:[2,136],35:[2,136],86:[2,136],68:[2,136],33:[2,136],95:[2,136],98:[2,136],94:[2,136],103:[2,136],104:[2,136],45:[2,136]},{10:[2,137],99:[2,137],88:[2,137],87:[2,137],71:[2,137],17:[2,137],15:[2,137],2:[2,137],12:[2,137],8:[2,137],67:[2,137],73:[2,137],35:[2,137],86:[2,137],68:[2,137],33:[2,137],95:[2,137],98:[2,137],94:[2,137],103:[2,137],104:[2,137],45:[2,137]},{34:136,106:91,49:92,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43]},{15:[2,143],17:[2,143],71:[2,143],87:[2,143],88:[2,143],99:[2,143],10:[2,143],2:[2,143],8:[2,143],12:[2,143],35:[2,143],104:[2,143],103:[2,143],94:[2,143],98:[2,143],95:[2,143],33:[2,143],68:[2,143],86:[2,143],73:[2,143],67:[2,143],45:[2,143]},{33:[1,137],35:[1,138]},{33:[2,76],35:[2,76]},{98:[1,57]},{8:[1,139],17:[2,27],15:[2,27],2:[2,27]},{33:[1,140],15:[2,63],17:[2,63],8:[2,63],2:[2,63],67:[2,63],73:[2,63],12:[2,63],35:[2,63],86:[2,63],68:[2,63],104:[2,63],103:[2,63],94:[2,63],98:[2,63],95:[2,63]},{63:141,65:[1,142],66:[1,143],69:144,70:[1,145],72:[1,146],75:[1,147],77:148,52:149,81:150,39:151,10:[1,152],82:153,83:154,96:[1,78],28:80,85:[1,155],101:32,112:[1,33],99:[1,24],87:[1,34],47:35,88:[1,36]},{12:[1,107],35:[1,108]},{29:156,22:[1,48]},{94:[1,157]},{31:158,107:25,108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{98:[2,154],94:[2,154],22:[2,154],109:[2,154],112:[2,154],88:[2,154],87:[2,154],85:[2,154],10:[2,154],99:[2,154],12:[2,154],35:[2,154],71:[2,154]},{111:159,31:160,107:25,108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{22:[2,130],99:[2,130],10:[2,130],85:[2,130],87:[2,130],88:[2,130],112:[2,130],109:[2,130],33:[2,130],35:[2,130],94:[2,130],98:[2,130],12:[2,130],71:[2,130],15:[2,130],17:[2,130],8:[2,130],95:[2,130],103:[2,130],104:[2,130],67:[2,130],73:[2,130],86:[2,130],68:[2,130],2:[2,130],96:[2,130]},{99:[2,125],10:[2,125],85:[2,125],87:[2,125],88:[2,125],112:[2,125],109:[2,125],94:[2,125],98:[2,125],22:[2,125],35:[2,125],12:[2,125],71:[2,125],104:[2,125],103:[2,125],95:[2,125],33:[2,125],8:[2,125],17:[2,125],15:[2,125],96:[2,125],2:[2,125],68:[2,125],86:[2,125],73:[2,125],67:[2,125]},{12:[2,128],35:[2,128]},{98:[2,121],94:[2,121],109:[2,121],112:[2,121],88:[2,121],87:[2,121],85:[2,121],10:[2,121],99:[2,121],22:[2,121],12:[2,121],35:[2,121],71:[2,121],15:[2,121],17:[2,121],8:[2,121],33:[2,121],95:[2,121],103:[2,121],104:[2,121],67:[2,121],73:[2,121],86:[2,121],68:[2,121],2:[2,121],96:[2,121]},{99:[2,119],10:[2,119],85:[2,119],87:[2,119],88:[2,119],112:[2,119],109:[2,119],94:[2,119],98:[2,119],22:[2,119],35:[2,119],12:[2,119],71:[2,119],15:[2,119],17:[2,119],45:[2,119],104:[2,119],103:[2,119],95:[2,119],33:[2,119],8:[2,119],96:[2,119],2:[2,119],68:[2,119],86:[2,119],73:[2,119],67:[2,119]},{57:161,59:162,35:[1,163],60:164,28:165,43:166,99:[1,24],10:[1,99],88:[1,43],12:[2,55]},{10:[1,167]},{35:[1,168],17:[2,29],15:[2,29],2:[2,29]},{15:[2,100],17:[2,100],35:[2,100],2:[2,100]},{35:[2,101],17:[2,101],15:[2,101],2:[2,101]},{35:[2,102],17:[2,102],15:[2,102],2:[2,102]},{99:[1,105],88:[1,169]},{15:[2,103],17:[2,103],35:[2,103],2:[2,103]},{35:[1,168],17:[2,30],15:[2,30],2:[2,30]},{35:[1,168],17:[2,31],15:[2,31],2:[2,31]},{8:[1,170]},{51:171,52:75,6:[1,76],53:77,96:[1,78],10:[1,79],28:80,87:[1,81],43:82,99:[1,24],88:[1,43],12:[2,41]},{35:[2,45],12:[2,45]},{54:[1,172],55:173,79:174,80:175,47:176,88:[1,36],10:[1,132],12:[2,81]},{12:[1,177]},{45:[1,178],17:[2,12],15:[2,12]},{15:[2,35],17:[2,35],45:[2,35]},{48:179,49:180,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43],45:[2,36],17:[2,36],15:[2,36]},{93:[1,61]},{22:[2,112],17:[2,112],15:[2,112],99:[2,112]},{34:181,106:91,49:92,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43]},{15:[2,141],17:[2,141],71:[2,141],87:[2,141],88:[2,141],99:[2,141],10:[2,141],2:[2,141],12:[2,141],8:[2,141],67:[2,141],73:[2,141],35:[2,141],86:[2,141],68:[2,141],33:[2,141],95:[2,141],98:[2,141],94:[2,141],103:[2,141],104:[2,141]},{12:[1,182]},{34:183,106:91,49:92,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43]},{28:184,99:[1,24],10:[1,99]},{25:185,13:[1,186]},{34:187,106:91,49:92,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43]},{64:188,89:189,90:190,95:[1,191],32:192,94:[1,193],97:194,98:[1,54],103:[1,63],104:[1,64],33:[2,64],8:[2,64],17:[2,64],15:[2,64],2:[2,64],67:[2,64],73:[2,64],35:[2,64],12:[2,64],86:[2,64],68:[2,64]},{66:[2,66],96:[2,66],10:[2,66],99:[2,66],85:[2,66],87:[2,66],88:[2,66],112:[2,66],70:[2,66],72:[2,66],75:[2,66],65:[2,66]},{37:195,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{77:196,52:149,81:150,39:151,10:[1,152],82:153,83:154,96:[1,78],28:80,85:[1,155],101:32,112:[1,33],99:[1,24],87:[1,34],47:35,88:[1,36],15:[2,69],17:[2,69],8:[2,69],33:[2,69],95:[2,69],98:[2,69],94:[2,69],103:[2,69],104:[2,69],67:[2,69],73:[2,69],12:[2,69],35:[2,69],86:[2,69],68:[2,69],2:[2,69]},{30:197,108:49,28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{37:198,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{25:199,13:[1,186]},{104:[2,73],103:[2,73],94:[2,73],98:[2,73],95:[2,73],33:[2,73],8:[2,73],17:[2,73],15:[2,73],96:[2,73],10:[2,73],99:[2,73],85:[2,73],87:[2,73],88:[2,73],112:[2,73],2:[2,73],12:[2,73],35:[2,73],68:[2,73],86:[2,73],73:[2,73],67:[2,73]},{15:[2,85],17:[2,85],8:[2,85],33:[2,85],95:[2,85],98:[2,85],94:[2,85],103:[2,85],104:[2,85],67:[2,85],73:[2,85],12:[2,85],35:[2,85],86:[2,85],68:[2,85],2:[2,85],112:[2,85],88:[2,85],87:[2,85],85:[2,85],99:[2,85],10:[2,85],96:[2,85]},{15:[2,86],17:[2,86],8:[2,86],33:[2,86],95:[2,86],98:[2,86],94:[2,86],103:[2,86],104:[2,86],67:[2,86],73:[2,86],12:[2,86],35:[2,86],86:[2,86],68:[2,86],2:[2,86],112:[2,86],88:[2,86],87:[2,86],85:[2,86],99:[2,86],10:[2,86],96:[2,86]},{15:[2,87],17:[2,87],8:[2,87],33:[2,87],95:[2,87],98:[2,87],94:[2,87],103:[2,87],104:[2,87],67:[2,87],73:[2,87],12:[2,87],35:[2,87],86:[2,87],68:[2,87],2:[2,87],112:[2,87],88:[2,87],87:[2,87],85:[2,87],99:[2,87],10:[2,87],96:[2,87]},{37:200,95:[1,128],12:[1,58],102:59,98:[1,57],97:60,93:[1,61],61:101,35:[1,62],103:[1,63],104:[1,64],62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{15:[2,89],17:[2,89],8:[2,89],33:[2,89],95:[2,89],98:[2,89],94:[2,89],103:[2,89],104:[2,89],67:[2,89],73:[2,89],12:[2,89],35:[2,89],86:[2,89],68:[2,89],2:[2,89],112:[2,89],88:[2,89],87:[2,89],85:[2,89],99:[2,89],10:[2,89],96:[2,89]},{15:[2,90],17:[2,90],8:[2,90],33:[2,90],95:[2,90],98:[2,90],94:[2,90],103:[2,90],104:[2,90],67:[2,90],73:[2,90],12:[2,90],35:[2,90],86:[2,90],68:[2,90],2:[2,90],112:[2,90],88:[2,90],87:[2,90],85:[2,90],99:[2,90],10:[2,90],96:[2,90]},{86:[1,70],84:201,37:202,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{15:[2,23],17:[2,23],2:[2,23]},{99:[2,111],10:[2,111],85:[2,111],87:[2,111],112:[2,111],109:[2,111],88:[2,111],15:[2,111],17:[2,111],35:[2,111],2:[2,111],75:[2,111],72:[2,111],70:[2,111],96:[2,111],66:[2,111],65:[2,111]},{12:[1,203]},{12:[1,204],35:[1,205]},{12:[2,157],35:[2,157]},{12:[1,206]},{35:[1,207],12:[2,52]},{12:[2,54]},{12:[2,57],35:[2,57]},{35:[2,58],12:[2,58]},{10:[1,208],35:[2,59],12:[2,59]},{57:209,59:162,35:[1,163],60:164,28:165,43:166,99:[1,24],10:[1,99],88:[1,43],12:[2,55]},{91:210,32:118,92:119,98:[1,54],94:[1,120],93:[1,121]},{94:[1,211]},{9:212,13:[1,5],5:[2,6]},{12:[2,42],35:[2,42]},{12:[1,213]},{12:[1,214]},{35:[1,215],12:[2,80]},{12:[2,83],35:[2,83]},{35:[2,84],12:[2,84]},{12:[2,132],35:[2,132],104:[2,132],103:[2,132],94:[2,132],98:[2,132],95:[2,132],33:[2,132],8:[2,132],17:[2,132],15:[2,132],96:[2,132],10:[2,132],99:[2,132],85:[2,132],87:[2,132],88:[2,132],112:[2,132],2:[2,132],68:[2,132],86:[2,132],73:[2,132],67:[2,132]},{46:216,47:131,88:[1,36],10:[1,132]},{49:217,105:93,100:94,10:[1,95],53:96,99:[1,87],87:[1,81],43:82,88:[1,43],45:[2,37],17:[2,37],15:[2,37]},{15:[2,39],17:[2,39],45:[2,39],87:[2,39],88:[2,39],99:[2,39],10:[2,39]},{17:[2,140],15:[2,140],2:[2,140],12:[2,140],8:[2,140],35:[2,140],104:[2,140],103:[2,140],94:[2,140],98:[2,140],95:[2,140],33:[2,140],68:[2,140],86:[2,140],73:[2,140],67:[2,140]},{10:[2,138],99:[2,138],88:[2,138],87:[2,138],71:[2,138],17:[2,138],15:[2,138],2:[2,138],12:[2,138],8:[2,138],67:[2,138],73:[2,138],35:[2,138],86:[2,138],68:[2,138],33:[2,138],95:[2,138],98:[2,138],94:[2,138],103:[2,138],104:[2,138],45:[2,138]},{15:[2,26],17:[2,26],2:[2,26]},{33:[2,75],35:[2,75]},{17:[2,28],15:[2,28],2:[2,28]},{15:[1,218],26:219,2:[1,220],19:221,27:16,28:17,31:18,10:[1,19],38:[1,21],41:[1,22],42:[1,23],99:[1,24],107:25,108:26,81:27,39:28,109:[1,29],110:30,85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{15:[2,62],17:[2,62],8:[2,62],2:[2,62],67:[2,62],73:[2,62],12:[2,62],35:[2,62],86:[2,62],68:[2,62],104:[2,62],103:[2,62],94:[2,62],98:[2,62],95:[2,62],33:[2,62]},{66:[2,65],96:[2,65],10:[2,65],99:[2,65],85:[2,65],87:[2,65],88:[2,65],112:[2,65],70:[2,65],72:[2,65],75:[2,65],65:[2,65]},{75:[2,97],72:[2,97],70:[2,97],112:[2,97],88:[2,97],87:[2,97],85:[2,97],99:[2,97],10:[2,97],96:[2,97],66:[2,97],65:[2,97]},{75:[2,98],72:[2,98],70:[2,98],112:[2,98],88:[2,98],87:[2,98],85:[2,98],99:[2,98],10:[2,98],96:[2,98],66:[2,98],65:[2,98]},{66:[2,105],96:[2,105],10:[2,105],99:[2,105],85:[2,105],87:[2,105],88:[2,105],112:[2,105],70:[2,105],72:[2,105],75:[2,105],65:[2,105]},{66:[2,106],96:[2,106],10:[2,106],99:[2,106],85:[2,106],87:[2,106],88:[2,106],112:[2,106],70:[2,106],72:[2,106],75:[2,106],65:[2,106]},{96:[1,222],87:[1,223],99:[1,105]},{66:[2,108],96:[2,108],10:[2,108],99:[2,108],85:[2,108],87:[2,108],88:[2,108],112:[2,108],70:[2,108],72:[2,108],75:[2,108],65:[2,108]},{67:[1,224]},{104:[2,74],103:[2,74],94:[2,74],98:[2,74],95:[2,74],33:[2,74],8:[2,74],17:[2,74],15:[2,74],96:[2,74],10:[2,74],99:[2,74],85:[2,74],87:[2,74],88:[2,74],112:[2,74],2:[2,74],12:[2,74],35:[2,74],68:[2,74],86:[2,74],73:[2,74],67:[2,74]},{71:[1,225],108:89,28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{73:[1,226]},{76:[1,227]},{12:[1,228],35:[1,229]},{86:[1,230],35:[1,231]},{86:[2,94],35:[2,94],12:[2,94]},{30:232,108:49,28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{94:[2,155],98:[2,155],22:[2,155],99:[2,155],10:[2,155],85:[2,155],87:[2,155],88:[2,155],112:[2,155],109:[2,155],35:[2,155],12:[2,155],71:[2,155]},{31:233,107:25,108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{15:[2,50],17:[2,50]},{60:234,28:165,43:166,99:[1,24],10:[1,99],88:[1,43],12:[2,53]},{54:[1,235],55:236,79:174,80:175,47:176,88:[1,36],10:[1,132],12:[2,81]},{12:[1,237]},{15:[2,99],17:[2,99],35:[2,99],2:[2,99]},{15:[2,104],17:[2,104],35:[2,104],2:[2,104]},{5:[2,3]},{35:[2,47],12:[2,47]},{35:[2,48],12:[2,48]},{80:238,47:176,88:[1,36],10:[1,132]},{15:[2,34],17:[2,34],45:[2,34]},{15:[2,38],17:[2,38],45:[2,38],87:[2,38],88:[2,38],99:[2,38],10:[2,38]},{15:[2,14],17:[2,14],2:[2,14],76:[2,14]},{15:[1,239],2:[1,240],17:[1,241]},{15:[1,242]},{15:[2,19],2:[2,19],17:[2,19]},{94:[1,243]},{94:[1,244]},{37:245,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{37:246,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{13:[1,247]},{37:248,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{15:[2,88],17:[2,88],8:[2,88],33:[2,88],95:[2,88],98:[2,88],94:[2,88],103:[2,88],104:[2,88],67:[2,88],73:[2,88],12:[2,88],35:[2,88],86:[2,88],68:[2,88],2:[2,88],112:[2,88],88:[2,88],87:[2,88],85:[2,88],99:[2,88],10:[2,88],96:[2,88]},{84:249,37:202,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{104:[2,92],103:[2,92],94:[2,92],98:[2,92],95:[2,92],33:[2,92],8:[2,92],17:[2,92],15:[2,92],96:[2,92],10:[2,92],99:[2,92],85:[2,92],87:[2,92],88:[2,92],112:[2,92],2:[2,92],12:[2,92],35:[2,92],68:[2,92],86:[2,92],73:[2,92],67:[2,92]},{37:250,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{29:251,108:89,22:[1,48],28:50,81:51,39:28,109:[1,29],110:30,10:[1,52],99:[1,24],85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{12:[2,156],35:[2,156]},{12:[2,56],35:[2,56]},{12:[1,252]},{12:[1,253]},{15:[2,51],17:[2,51]},{12:[2,82],35:[2,82]},{15:[2,15],17:[2,15],2:[2,15],76:[2,15]},{15:[1,254]},{19:255,27:16,28:17,31:18,10:[1,19],38:[1,21],41:[1,22],42:[1,23],99:[1,24],107:25,108:26,81:27,39:28,109:[1,29],110:30,85:[1,31],101:32,112:[1,33],87:[1,34],47:35,88:[1,36]},{15:[2,16],17:[2,16],2:[2,16],76:[2,16]},{66:[2,107],96:[2,107],10:[2,107],99:[2,107],85:[2,107],87:[2,107],88:[2,107],112:[2,107],70:[2,107],72:[2,107],75:[2,107],65:[2,107]},{66:[2,109],96:[2,109],10:[2,109],99:[2,109],85:[2,109],87:[2,109],88:[2,109],112:[2,109],70:[2,109],72:[2,109],75:[2,109],65:[2,109]},{68:[1,256]},{15:[2,70],17:[2,70],8:[2,70],33:[2,70],95:[2,70],98:[2,70],94:[2,70],103:[2,70],104:[2,70],67:[2,70],73:[2,70],12:[2,70],35:[2,70],86:[2,70],68:[2,70],2:[2,70]},{74:257,78:258,31:259,107:25,108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{15:[2,72],17:[2,72],8:[2,72],33:[2,72],95:[2,72],98:[2,72],94:[2,72],103:[2,72],104:[2,72],67:[2,72],73:[2,72],12:[2,72],35:[2,72],86:[2,72],68:[2,72],2:[2,72]},{12:[1,260],35:[1,231]},{86:[2,93],35:[2,93],12:[2,93]},{15:[2,24],17:[2,24],2:[2,24]},{35:[2,60],12:[2,60]},{35:[2,61],12:[2,61]},{15:[2,17],17:[2,17],2:[2,17],76:[2,17]},{15:[2,18],2:[2,18],17:[2,18]},{37:261,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{15:[1,262],17:[1,263]},{15:[2,78],17:[2,78]},{71:[1,264]},{104:[2,91],103:[2,91],94:[2,91],98:[2,91],95:[2,91],33:[2,91],8:[2,91],17:[2,91],15:[2,91],96:[2,91],10:[2,91],99:[2,91],85:[2,91],87:[2,91],88:[2,91],112:[2,91],2:[2,91],12:[2,91],35:[2,91],68:[2,91],86:[2,91],73:[2,91],67:[2,91]},{15:[2,68],17:[2,68],8:[2,68],33:[2,68],95:[2,68],98:[2,68],94:[2,68],103:[2,68],104:[2,68],67:[2,68],73:[2,68],12:[2,68],35:[2,68],86:[2,68],68:[2,68],2:[2,68]},{15:[2,71],17:[2,71],8:[2,71],33:[2,71],95:[2,71],98:[2,71],94:[2,71],103:[2,71],104:[2,71],67:[2,71],73:[2,71],12:[2,71],35:[2,71],86:[2,71],68:[2,71],2:[2,71]},{78:265,31:259,107:25,108:26,81:27,28:50,39:28,109:[1,29],110:30,10:[1,52],85:[1,31],101:32,99:[1,24],112:[1,33],87:[1,34],47:35,88:[1,36]},{37:266,61:101,62:102,66:[2,67],96:[2,67],10:[2,67],99:[2,67],85:[2,67],87:[2,67],88:[2,67],112:[2,67],70:[2,67],72:[2,67],75:[2,67],65:[2,67]},{15:[2,77],17:[2,77]},{17:[2,79],15:[2,79]}],
defaultActions: {4:[2,4],6:[2,1],39:[2,5],71:[2,2],163:[2,54],212:[2,3]},
parseError: 
function parseError(str, hash) {
    throw new Error(str);
}
,
parse: 
function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    if (typeof this.yy.parseError === "function") {
        this.parseError = this.yy.parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null) {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            if (!recovering) {
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                }
                var errStr = "";
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ");
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1 ? "end of input" : ("'" + (this.terminals_[symbol] || symbol) + "'"));
                }
                this.parseError(errStr, {text:this.lexer.match, token:this.terminals_[symbol] || symbol, line:this.lexer.yylineno, loc:yyloc, expected:expected});
            }
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || "Parsing halted.");
                }
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }
            while (1) {
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || "Parsing halted.");
                }
                popStack(1);
                state = stack[stack.length - 1];
            }
            preErrorSymbol = symbol;
            symbol = TERROR;
            state = stack[stack.length - 1];
            action = table[state] && table[state][TERROR];
            recovering = 3;
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
          case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
          case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line:lstack[lstack.length - (len || 1)].first_line, last_line:lstack[lstack.length - 1].last_line, first_column:lstack[lstack.length - (len || 1)].first_column, last_column:lstack[lstack.length - 1].last_column};
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
          case 3:
            return true;
        }
    }
    return true;
}
};
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = JSHCparser;
exports.parse = function () { return JSHCparser.parse.apply(JSHCparser, arguments); }
exports.main = 
function commonjsMain(args) {
    if (!args[1]) {
        throw new Error("Usage: " + args[0] + " FILE");
    }
    if (typeof process !== "undefined") {
        var source = require("fs").readFileSync(require("path").join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset:"utf-8"});
    }
    return exports.parser.parse(source);
}

if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}

// --- src/Parser/JSHCparserExp.js ---
/* Jison generated parser */
var JSHCparserExp = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"start_":3,"{":4,"exp":5,"}":6,"EOF":7,"module_":8,"module":9,"modid":10,"where":11,"body":12,"(":13,"exports":14,")":15,"topdecls":16,"topdecls_nonempty":17,";":18,"topdecl":19,"decl":20,"data":21,"simpletype":22,"=":23,"constrs":24,"impdecl":25,"decls":26,"list_decl_comma_1":27,"decl_fixity":28,"var":29,"rhs":30,"apats":31,"pat":32,"varop":33,"::":34,"type":35,",":36,"vars":37,"infixl":38,"literal":39,"op_list_1_comma":40,"infixr":41,"infix":42,"tycon":43,"tyvars":44,"|":45,"constr":46,"con":47,"atypes":48,"atype":49,"exports_inner":50,"export":51,"qvar":52,"qtycon":53,"..":54,"list_cname_0_comma":55,"import":56,"imports":57,"hiding":58,"list_import_1_comma":59,"import_a":60,"infixexp":61,"infixexpLR":62,"lexp":63,"qop":64,"-":65,"if":66,"then":67,"else":68,"fexp":69,"\\":70,"->":71,"case":72,"of":73,"alts":74,"let":75,"in":76,"aexp":77,"alt":78,"list_cname_1_comma":79,"cname":80,"gcon":81,"tuple":82,"listexp":83,"list_exp_1_comma":84,"[":85,"]":86,"qconid":87,"conid":88,"qvarop":89,"qconop":90,"op":91,"conop":92,"consym":93,"`":94,"qvarsym":95,"qvarid":96,"gconsym":97,"varsym":98,"varid":99,"tyvar":100,"qcon":101,"list_1_comma":102,":":103,"qconsym":104,"gtycon":105,"apptype":106,"lpat":107,"apat":108,"_":109,"tuple_pat":110,"pat_list_1_comma":111,"integer":112,"$accept":0,"$end":1},
terminals_: {2:"error",4:"{",6:"}",7:"EOF",9:"module",11:"where",13:"(",15:")",18:";",21:"data",23:"=",34:"::",36:",",38:"infixl",41:"infixr",42:"infix",45:"|",54:"..",56:"import",58:"hiding",65:"-",66:"if",67:"then",68:"else",70:"\\",71:"->",72:"case",73:"of",75:"let",76:"in",85:"[",86:"]",87:"qconid",88:"conid",93:"consym",94:"`",95:"qvarsym",96:"qvarid",98:"varsym",99:"varid",103:":",104:"qconsym",109:"_",112:"integer"},
productions_: [0,[3,4],[8,4],[8,7],[8,1],[12,3],[12,0],[16,1],[17,3],[17,1],[19,1],[19,2],[19,4],[19,1],[26,2],[26,3],[26,3],[26,4],[27,3],[27,1],[20,1],[20,2],[20,3],[20,4],[20,7],[20,3],[20,5],[30,2],[30,4],[28,3],[28,3],[28,3],[22,1],[22,2],[24,3],[24,1],[46,1],[46,2],[48,2],[48,1],[14,1],[14,2],[50,3],[50,1],[51,1],[51,2],[51,1],[51,4],[51,4],[25,2],[25,5],[25,6],[57,1],[57,2],[57,1],[57,0],[59,3],[59,1],[60,1],[60,1],[60,4],[60,4],[5,3],[5,1],[61,2],[62,3],[62,2],[62,0],[63,6],[63,1],[63,4],[63,6],[63,4],[69,1],[69,2],[37,3],[37,1],[74,3],[74,1],[78,3],[55,1],[55,0],[79,3],[79,1],[80,1],[77,1],[77,1],[77,1],[77,3],[77,1],[77,1],[82,5],[83,3],[84,3],[84,1],[10,1],[10,1],[64,1],[64,1],[40,3],[40,1],[91,1],[91,1],[92,1],[92,3],[89,1],[89,1],[89,3],[90,1],[90,3],[33,1],[33,3],[44,2],[44,1],[100,1],[43,1],[53,1],[53,1],[47,1],[47,3],[101,1],[101,3],[101,1],[81,2],[81,2],[81,3],[81,1],[102,1],[102,2],[29,1],[29,3],[52,1],[52,3],[52,1],[97,1],[97,1],[49,1],[49,1],[49,3],[35,1],[35,3],[106,2],[106,1],[105,1],[32,1],[107,1],[107,2],[31,1],[31,2],[108,1],[108,1],[108,1],[108,1],[108,1],[108,3],[110,5],[111,3],[111,1],[39,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return $$[$0-2]; 
break;
case 2:this.$ = {name: "module", modid: $$[$0-2], body: $$[$0], pos: this._$}; 
break;
case 3:this.$ = {name: "module", modid: $$[$0-5], exports: $$[$0-3], body: $$[$0], pos: this._$}; 
break;
case 4:this.$ = {name: "module", modid: new JSHC.ModName("Main"), body: $$[$0], pos:this._$}; 
break;
case 5: 
        var imps = [], decs = [], atdecs = false;
        for (var i = 0; i < $$[$0-1].length; i++) {
            if ($$[$0-1][i].name == "impdecl" && !atdecs) {
                imps.push($$[$0-1][i]);
            } else if ($$[$0-1][i].name == "impdecl" && atdecs) {
                throw new Error("Parse error: import declaration in statement block at line " + $$[$0-1][i].pos.first_line);
            } else {
                atdecs = true;
                decs.push($$[$0-1][i]);
            }
        }
        
        // add Prelude as an import if not explicitly imported
        var prelude_imported = false;
        for(i=0 ; i<imps.length ; i++){
	    if( imps[i].modid == "Prelude" ){
	        prelude_imported = true;
	        break;
            }
        }
        if( ! prelude_imported ){
            imps.push({name: "impdecl", modid: new JSHC.ModName("Prelude")});
        }

        this.$ = {name: "body", impdecls: imps, topdecls: decs, pos:this._$}; 
break;
case 6:this.$ = {name: "body", impdecls: [], topdecls: [], pos:this._$}; 
break;
case 7: this.$ = $$[$0]; 
break;
case 8: $$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 9: this.$ = [$$[$0]]; 
break;
case 10:this.$ = {name: "topdecl-decl", decl: $$[$0], pos: this._$};
break;
case 11:this.$ = {name: "topdecl-data", typ: $$[$0], constrs: [], pos: this._$};
break;
case 12:this.$ = {name: "topdecl-data", typ: $$[$0-2], constrs: $$[$0], pos: this._$};
break;
case 13:this.$ = $$[$0];
break;
case 14: this.$ = []; 
break;
case 15: this.$ = $$[$0-1]; 
break;
case 16: this.$ = []; 
break;
case 17: this.$ = $$[$0-2]; 
break;
case 18: ($$[$0-2]).push($$[$0]); this.$ = $$[$0-2]; 
break;
case 19: this.$ = [$$[$0]]; 
break;
case 20:this.$ = $$[$0];
break;
case 21:this.$ = {name:"decl-fun", ident: $$[$0-1], args: [], rhs: $$[$0], pos: this._$};
break;
case 22:this.$ = {name:"decl-fun", ident: $$[$0-2], args: $$[$0-1], rhs: $$[$0], pos: this._$};
break;
case 23:this.$ = {name:"decl-fun", ident: $$[$0-2], args: [$$[$0-3],$$[$0-1]], rhs: $$[$0], pos: this._$, orig: "infix"};
break;
case 24:this.$ = {name:"decl-fun", ident: $$[$0-4], args: [$$[$0-5],$$[$0-3]].concat($$[$0-1]), rhs: $$[$0], pos: this._$, orig: "infix"};
break;
case 25:this.$ = {name:"type-signature",vars:[$$[$0-2]],sig:$$[$0],pos:this._$};
break;
case 26:this.$ = {name:"type-signature",vars:[$$[$0-4]].concat($$[$0-2]),sig:$$[$0],pos:this._$};
break;
case 27:this.$ = $$[$0];
break;
case 28:this.$ = {name: "fun-where", exp: $$[$0-2], decls: $$[$0], pos: this._$}; 
break;
case 29: this.$ = {name: "fixity", fix: "leftfix", num: $$[$0-1], ops: $$[$0], pos: this._$}; 
break;
case 30: this.$ = {name: "fixity", fix: "rightfix", num: $$[$0-1], ops: $$[$0], pos: this._$}; 
break;
case 31: this.$ = {name: "fixity",  fix: "nonfix",num: $$[$0-1], ops: $$[$0], pos: this._$}; 
break;
case 32:this.$ = {name: "simpletype", tycon: $$[$0], vars: [], pos: this._$};
break;
case 33:this.$ = {name: "simpletype", tycon: $$[$0-1], vars: $$[$0], pos: this._$};
break;
case 34:$$[$0-2].push($$[$0]); this.$ = $$[$0-2];
break;
case 35:this.$ = [$$[$0]];
break;
case 36:this.$ = {name: "constr", dacon: $$[$0], types: [], pos: this._$};
break;
case 37:this.$ = {name: "constr", dacon: $$[$0-1], types: $$[$0], pos: this._$};
break;
case 38:$$[$0-1].push($$[$0]); this.$ = $$[$0-1];
break;
case 39:this.$ = [$$[$0]];
break;
case 40:this.$ = $$[$0];
break;
case 41:this.$ = $$[$0-1];
break;
case 42:$$[$0-2].push($$[$0]); this.$ = $$[$0-2];
break;
case 43:this.$ = [$$[$0]];
break;
case 44:this.$ = {name: "export-qvar", exp: $$[$0], pos: this._$};
break;
case 45:this.$ = {name: "export-module", exp: $$[$0], pos: this._$};
break;
case 46:this.$ = {name: "export-type-unspec", exp: $$[$0], pos: this._$};
break;
case 47:this.$ = {name: "export-type-all", exp: $$[$0-3], pos: this._$};
break;
case 48:this.$ = {name: "export-type-vars", exp: $$[$0-3], vars: $$[$0-1], pos: this._$};
break;
case 49:this.$ = {name: "impdecl", modid: $$[$0], pos: this._$};
break;
case 50:this.$ = {name: "impdecl", modid: $$[$0-3], hiding: false, imports: $$[$0-1], pos: this._$};
break;
case 51:this.$ = {name: "impdecl", modid: $$[$0-4], hiding: true, imports: $$[$0-1], pos: this._$};
break;
case 52:this.$ = $$[$0];
break;
case 53:this.$ = $$[$0-1];
break;
case 54:this.$ = [];
break;
case 55:this.$ = [];
break;
case 56:$$[$0-2].push($$[$0]); this.$ = $$[$0-2];
break;
case 57:this.$ = [$$[$0]];
break;
case 58:this.$ = {name: "import-var", varname: $$[$0], pos: this._$};
break;
case 59:this.$ = {name: "import-tycon", tycon: $$[$0], all: false, pos: this._$};
break;
case 60:this.$ = {name: "import-tycon", tycon: $$[$0-3], all: true, pos: this._$};
break;
case 61:this.$ = {name: "import-tycon", tycon: $$[$0-3], all: false, list:$$[$0-1], pos: this._$};
break;
case 62:this.$ = {name:"type-signature",exp:$$[$0-2],sig:$$[$0],pos:this._$};
break;
case 63:this.$ = $$[$0];
break;
case 64:
          ($$[$0-1]).push($$[$0]);
          if( ($$[$0-1]).length == 1 && ($$[$0-1])[0].name=="infixexp" ){
                  this.$ = ($$[$0-1])[0];
          } else {
              this.$ = {name:"infixexp",exps:$$[$0-1],pos:this._$};
          }
      
break;
case 65:($$[$0-2]).push($$[$0-1],$$[$0]); this.$ = $$[$0-2];
break;
case 66:($$[$0-1]).push($$[$0]);    this.$ = $$[$0];
break;
case 67:this.$ = [];
break;
case 68:this.$ = {name:"ite",e1:$$[$0-4],e2:$$[$0-2],e3:$$[$0],pos:this._$}; 
break;
case 69: this.$ = ($$[$0].length === 1) ? ($$[$0][0]) : {name:"application", exps:$$[$0],pos:this._$}; 
break;
case 70:this.$ = {name:"lambda", args: $$[$0-2], rhs: $$[$0], pos: this._$}; 
break;
case 71:this.$ = {name:"case", exp: $$[$0-4], alts: $$[$0-1], pos: this._$}; 
break;
case 72:this.$ = {name:"let", decls: $$[$0-2], exp: $$[$0], pos: this._$}; 
break;
case 73:this.$ = [$$[$0]];
break;
case 74:($$[$0-1]).push($$[$0]); this.$ = $$[$0-1];
break;
case 75:$$[$0-2].push($$[$0]); this.$ = $$[$0-2];
break;
case 76:this.$ = [$$[$0]];
break;
case 77:$$[$0-2].push($$[$0]); this.$ = $$[$0-2];
break;
case 78:this.$ = [$$[$0]];
break;
case 79:this.$ = {name:"alt", pat: $$[$0-2], exp: $$[$0]};
break;
case 80:this.$ = $$[$0];
break;
case 81:this.$ = [];
break;
case 82:$$[$0-2].push($$[$0]); this.$ = $$[$0-2];
break;
case 83:this.$ = [$$[$0]];
break;
case 84:this.$ = $$[$0];
break;
case 85:this.$ = $$[$0];
break;
case 86:this.$ = $$[$0];
break;
case 87:this.$ = $$[$0];
break;
case 88:this.$ = $$[$0-1];
break;
case 89:this.$ = $$[$0];
break;
case 90:this.$ = $$[$0];
break;
case 91:$$[$0-1].unshift($$[$0-3]); this.$ = {name: "tuple", members: $$[$0-1], pos: this._$}; 
break;
case 92: this.$ = {name: "listexp", members: $$[$0-1], pos: this._$}; 
break;
case 93:$$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 94:this.$ = [$$[$0]];
break;
case 95:this.$ = new JSHC.ModName($$[$0], this._$, yy.lexer.previous.qual);
break;
case 96:this.$ = new JSHC.ModName($$[$0], this._$);
break;
case 97:this.$ = {name: "qop", id: $$[$0], pos: this._$};
break;
case 98:this.$ = {name: "qop", id: $$[$0], pos: this._$};
break;
case 99: $$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 100: this.$ = [$$[$0]]; 
break;
case 101: this.$ = $$[$0]; 
break;
case 102: this.$ = $$[$0]; 
break;
case 103: this.$ = new JSHC.DaCon($$[$0], this._$, true); 
break;
case 104: this.$ = new JSHC.DaCon($$[$0-1], this._$, false); 
break;
case 105:this.$ = new JSHC.VarName($$[$0], this._$, true, yy.lexer.previous.qual);
break;
case 106:this.$ = $$[$0];
break;
case 107:this.$ = new JSHC.VarName($$[$0-1], this._$, false, yy.lexer.previous.qual);
break;
case 108:this.$ = $$[$0];
break;
case 109:this.$ = new JSHC.DaCon($$[$0-1], this._$, false, yy.lexer.previous.qual);
break;
case 110:this.$ = new JSHC.VarName($$[$0], this._$, true);
break;
case 111:this.$ = new JSHC.VarName($$[$0-1], this._$, false)
break;
case 112:$$[$0-1].push($$[$0]); this.$ = $$[$0-1];
break;
case 113:this.$ = [$$[$0]];
break;
case 114:this.$ = new JSHC.TyVar($$[$0], this._$);
break;
case 115:this.$ = new JSHC.TyCon($$[$0], this._$);
break;
case 116:this.$ = new JSHC.TyCon($$[$0], this._$, yy.lexer.previous.qual);
break;
case 117:this.$ = $$[$0];
break;
case 118:this.$ = new JSHC.DaCon($$[$0], this._$, false);
break;
case 119:this.$ = new JSHC.DaCon($$[$0-1], this._$, true);
break;
case 120:this.$ = new JSHC.DaCon($$[$0], this._$, false, yy.lexer.previous.qual);
break;
case 121:this.$ = $$[$0-1];
break;
case 122:this.$ = $$[$0];
break;
case 123:this.$ = new JSHC.UnitDaCon(this._$);
break;
case 124:this.$ = new JSHC.NilDaCon(this._$);
break;
case 125:this.$ = new JSHC.TupleDaCon($$[$0-1] + 1, this._$);
break;
case 126:this.$ = $$[$0];
break;
case 127:this.$ = 1;
break;
case 128:this.$ = $$[$0-1] + 1;
break;
case 129:this.$ = new JSHC.VarName($$[$0], this._$, false);
break;
case 130:this.$ = new JSHC.VarName($$[$0-1], this._$, true);
break;
case 131:this.$ = new JSHC.VarName($$[$0], this._$, false, yy.lexer.previous.qual);
break;
case 132:this.$ = new JSHC.VarName($$[$0-1], this._$, true, yy.lexer.previous.qual);
break;
case 133:this.$ = $$[$0];
break;
case 134:this.$ = new JSHC.ConsDaCon(this._$);
break;
case 135:this.$ = new JSHC.DaCon($$[$0], this._$, true, yy.lexer.previous.qual);
break;
case 136:this.$ = $$[$0];
break;
case 137:this.$ = $$[$0];
break;
case 138:this.$ = $$[$0-1];
break;
case 139:this.$ = $$[$0];
break;
case 140:this.$ = new JSHC.FunType([$$[$0-2],$$[$0]],this._$);
break;
case 141:this.$ = new JSHC.AppType($$[$0-1],$$[$0],this._$);
break;
case 142:this.$ = $$[$0];
break;
case 143:this.$ = $$[$0];
break;
case 144:this.$ = $$[$0];
break;
case 145:this.$ = $$[$0];
break;
case 146:this.$ = {name: "conpat", con: $$[$0-1], pats: $$[$0]}; 
break;
case 147:this.$ = [$$[$0]];
break;
case 148:$$[$0-1].push($$[$0]); this.$ = $$[$0-1];
break;
case 149:this.$ = $$[$0]; 
break;
case 150:this.$ = $$[$0]; 
break;
case 151:this.$ = $$[$0]; 
break;
case 152:this.$ = {name:"wildcard", pos: this._$}; 
break;
case 153:this.$ = $$[$0]; 
break;
case 154:this.$ = $$[$0-1]; 
break;
case 155:$$[$0-1].unshift($$[$0-3]); this.$ = {name: "tuple_pat", members: $$[$0-1], pos: this._$}; 
break;
case 156:$$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 157:this.$ = [$$[$0]]; 
break;
case 158:this.$ = {name: "integer-lit", value: Number($$[$0]), pos: this._$};
break;
}
},
table: [{3:1,4:[1,2]},{1:[3]},{5:3,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{6:[1,6]},{2:[2,63],6:[2,63],11:[2,63],15:[2,63],18:[2,63],34:[1,7],36:[2,63],67:[2,63],68:[2,63],73:[2,63],86:[2,63],94:[2,63],95:[2,63],98:[2,63],103:[2,63],104:[2,63]},{13:[1,19],29:23,39:18,47:29,52:16,63:8,65:[1,9],66:[1,10],69:11,70:[1,12],72:[1,13],75:[1,14],77:15,81:17,82:20,83:21,85:[1,24],87:[1,28],88:[1,30],96:[1,22],99:[1,27],101:25,112:[1,26]},{7:[1,31]},{13:[1,37],35:32,43:41,49:34,53:38,87:[1,40],88:[1,42],99:[1,39],100:36,105:35,106:33},{2:[2,64],6:[2,64],11:[2,64],15:[2,64],18:[2,64],33:47,34:[2,64],36:[2,64],64:43,67:[2,64],68:[2,64],73:[2,64],86:[2,64],89:44,90:45,94:[1,48],95:[1,46],97:49,98:[1,50],103:[1,51],104:[1,52]},{13:[2,66],65:[2,66],66:[2,66],70:[2,66],72:[2,66],75:[2,66],85:[2,66],87:[2,66],88:[2,66],96:[2,66],99:[2,66],112:[2,66]},{5:53,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{2:[2,69],6:[2,69],11:[2,69],13:[1,19],15:[2,69],18:[2,69],29:23,34:[2,69],36:[2,69],39:18,47:29,52:16,67:[2,69],68:[2,69],73:[2,69],77:54,81:17,82:20,83:21,85:[1,24],86:[2,69],87:[1,28],88:[1,30],94:[2,69],95:[2,69],96:[1,22],98:[2,69],99:[1,27],101:25,103:[2,69],104:[2,69],112:[1,26]},{13:[1,62],29:57,31:55,39:59,47:29,81:58,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,108:56,109:[1,60],110:61,112:[1,26]},{5:64,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{4:[1,66],26:65},{2:[2,73],6:[2,73],11:[2,73],13:[2,73],15:[2,73],18:[2,73],34:[2,73],36:[2,73],67:[2,73],68:[2,73],73:[2,73],85:[2,73],86:[2,73],87:[2,73],88:[2,73],94:[2,73],95:[2,73],96:[2,73],98:[2,73],99:[2,73],103:[2,73],104:[2,73],112:[2,73]},{2:[2,85],6:[2,85],11:[2,85],13:[2,85],15:[2,85],18:[2,85],34:[2,85],36:[2,85],67:[2,85],68:[2,85],73:[2,85],85:[2,85],86:[2,85],87:[2,85],88:[2,85],94:[2,85],95:[2,85],96:[2,85],98:[2,85],99:[2,85],103:[2,85],104:[2,85],112:[2,85]},{2:[2,86],6:[2,86],11:[2,86],13:[2,86],15:[2,86],18:[2,86],34:[2,86],36:[2,86],67:[2,86],68:[2,86],73:[2,86],85:[2,86],86:[2,86],87:[2,86],88:[2,86],94:[2,86],95:[2,86],96:[2,86],98:[2,86],99:[2,86],103:[2,86],104:[2,86],112:[2,86]},{2:[2,87],6:[2,87],11:[2,87],13:[2,87],15:[2,87],18:[2,87],34:[2,87],36:[2,87],67:[2,87],68:[2,87],73:[2,87],85:[2,87],86:[2,87],87:[2,87],88:[2,87],94:[2,87],95:[2,87],96:[2,87],98:[2,87],99:[2,87],103:[2,87],104:[2,87],112:[2,87]},{5:67,13:[2,67],15:[1,69],36:[1,74],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],93:[1,73],95:[1,68],96:[2,67],97:72,98:[1,71],99:[2,67],102:70,103:[1,51],104:[1,52],112:[2,67]},{2:[2,89],6:[2,89],11:[2,89],13:[2,89],15:[2,89],18:[2,89],34:[2,89],36:[2,89],67:[2,89],68:[2,89],73:[2,89],85:[2,89],86:[2,89],87:[2,89],88:[2,89],94:[2,89],95:[2,89],96:[2,89],98:[2,89],99:[2,89],103:[2,89],104:[2,89],112:[2,89]},{2:[2,90],6:[2,90],11:[2,90],13:[2,90],15:[2,90],18:[2,90],34:[2,90],36:[2,90],67:[2,90],68:[2,90],73:[2,90],85:[2,90],86:[2,90],87:[2,90],88:[2,90],94:[2,90],95:[2,90],96:[2,90],98:[2,90],99:[2,90],103:[2,90],104:[2,90],112:[2,90]},{2:[2,131],6:[2,131],11:[2,131],13:[2,131],15:[2,131],18:[2,131],34:[2,131],36:[2,131],67:[2,131],68:[2,131],73:[2,131],85:[2,131],86:[2,131],87:[2,131],88:[2,131],94:[2,131],95:[2,131],96:[2,131],98:[2,131],99:[2,131],103:[2,131],104:[2,131],112:[2,131]},{2:[2,133],6:[2,133],11:[2,133],13:[2,133],15:[2,133],18:[2,133],34:[2,133],36:[2,133],67:[2,133],68:[2,133],73:[2,133],85:[2,133],86:[2,133],87:[2,133],88:[2,133],94:[2,133],95:[2,133],96:[2,133],98:[2,133],99:[2,133],103:[2,133],104:[2,133],112:[2,133]},{5:77,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],84:76,85:[2,67],86:[1,75],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{2:[2,126],6:[2,126],11:[2,126],13:[2,126],15:[2,126],18:[2,126],23:[2,126],34:[2,126],36:[2,126],67:[2,126],68:[2,126],71:[2,126],73:[2,126],85:[2,126],86:[2,126],87:[2,126],88:[2,126],94:[2,126],95:[2,126],96:[2,126],98:[2,126],99:[2,126],103:[2,126],104:[2,126],109:[2,126],112:[2,126]},{2:[2,158],6:[2,158],11:[2,158],13:[2,158],15:[2,158],18:[2,158],23:[2,158],34:[2,158],36:[2,158],67:[2,158],68:[2,158],71:[2,158],73:[2,158],85:[2,158],86:[2,158],87:[2,158],88:[2,158],93:[2,158],94:[2,158],95:[2,158],96:[2,158],98:[2,158],99:[2,158],103:[2,158],104:[2,158],109:[2,158],112:[2,158]},{2:[2,129],6:[2,129],11:[2,129],13:[2,129],15:[2,129],18:[2,129],23:[2,129],34:[2,129],36:[2,129],67:[2,129],68:[2,129],71:[2,129],73:[2,129],85:[2,129],86:[2,129],87:[2,129],88:[2,129],94:[2,129],95:[2,129],96:[2,129],98:[2,129],99:[2,129],103:[2,129],104:[2,129],109:[2,129],112:[2,129]},{2:[2,120],6:[2,120],11:[2,120],13:[2,120],15:[2,120],18:[2,120],23:[2,120],34:[2,120],36:[2,120],67:[2,120],68:[2,120],71:[2,120],73:[2,120],85:[2,120],86:[2,120],87:[2,120],88:[2,120],94:[2,120],95:[2,120],96:[2,120],98:[2,120],99:[2,120],103:[2,120],104:[2,120],109:[2,120],112:[2,120]},{2:[2,122],6:[2,122],11:[2,122],13:[2,122],15:[2,122],18:[2,122],23:[2,122],34:[2,122],36:[2,122],67:[2,122],68:[2,122],71:[2,122],73:[2,122],85:[2,122],86:[2,122],87:[2,122],88:[2,122],94:[2,122],95:[2,122],96:[2,122],98:[2,122],99:[2,122],103:[2,122],104:[2,122],109:[2,122],112:[2,122]},{2:[2,118],6:[2,118],11:[2,118],13:[2,118],15:[2,118],18:[2,118],23:[2,118],34:[2,118],36:[2,118],67:[2,118],68:[2,118],71:[2,118],73:[2,118],85:[2,118],86:[2,118],87:[2,118],88:[2,118],94:[2,118],95:[2,118],96:[2,118],98:[2,118],99:[2,118],103:[2,118],104:[2,118],109:[2,118],112:[2,118]},{1:[2,1]},{2:[2,62],6:[2,62],11:[2,62],15:[2,62],18:[2,62],34:[2,62],36:[2,62],67:[2,62],68:[2,62],73:[2,62],86:[2,62],94:[2,62],95:[2,62],98:[2,62],103:[2,62],104:[2,62]},{2:[2,139],6:[2,139],11:[2,139],13:[1,37],15:[2,139],18:[2,139],34:[2,139],36:[2,139],43:41,49:79,53:38,67:[2,139],68:[2,139],71:[1,78],73:[2,139],86:[2,139],87:[1,40],88:[1,42],94:[2,139],95:[2,139],98:[2,139],99:[1,39],100:36,103:[2,139],104:[2,139],105:35},{2:[2,142],6:[2,142],11:[2,142],13:[2,142],15:[2,142],18:[2,142],34:[2,142],36:[2,142],67:[2,142],68:[2,142],71:[2,142],73:[2,142],86:[2,142],87:[2,142],88:[2,142],94:[2,142],95:[2,142],98:[2,142],99:[2,142],103:[2,142],104:[2,142]},{2:[2,136],6:[2,136],11:[2,136],13:[2,136],15:[2,136],18:[2,136],34:[2,136],36:[2,136],67:[2,136],68:[2,136],71:[2,136],73:[2,136],86:[2,136],87:[2,136],88:[2,136],94:[2,136],95:[2,136],98:[2,136],99:[2,136],103:[2,136],104:[2,136]},{2:[2,137],6:[2,137],11:[2,137],13:[2,137],15:[2,137],18:[2,137],34:[2,137],36:[2,137],67:[2,137],68:[2,137],71:[2,137],73:[2,137],86:[2,137],87:[2,137],88:[2,137],94:[2,137],95:[2,137],98:[2,137],99:[2,137],103:[2,137],104:[2,137]},{13:[1,37],35:80,43:41,49:34,53:38,87:[1,40],88:[1,42],99:[1,39],100:36,105:35,106:33},{2:[2,143],6:[2,143],11:[2,143],13:[2,143],15:[2,143],18:[2,143],34:[2,143],36:[2,143],67:[2,143],68:[2,143],71:[2,143],73:[2,143],86:[2,143],87:[2,143],88:[2,143],94:[2,143],95:[2,143],98:[2,143],99:[2,143],103:[2,143],104:[2,143]},{2:[2,114],6:[2,114],11:[2,114],13:[2,114],15:[2,114],18:[2,114],34:[2,114],36:[2,114],67:[2,114],68:[2,114],71:[2,114],73:[2,114],86:[2,114],87:[2,114],88:[2,114],94:[2,114],95:[2,114],98:[2,114],99:[2,114],103:[2,114],104:[2,114]},{2:[2,116],6:[2,116],11:[2,116],13:[2,116],15:[2,116],18:[2,116],34:[2,116],36:[2,116],67:[2,116],68:[2,116],71:[2,116],73:[2,116],86:[2,116],87:[2,116],88:[2,116],94:[2,116],95:[2,116],98:[2,116],99:[2,116],103:[2,116],104:[2,116]},{2:[2,117],6:[2,117],11:[2,117],13:[2,117],15:[2,117],18:[2,117],34:[2,117],36:[2,117],67:[2,117],68:[2,117],71:[2,117],73:[2,117],86:[2,117],87:[2,117],88:[2,117],94:[2,117],95:[2,117],98:[2,117],99:[2,117],103:[2,117],104:[2,117]},{2:[2,115],6:[2,115],11:[2,115],13:[2,115],15:[2,115],18:[2,115],34:[2,115],36:[2,115],67:[2,115],68:[2,115],71:[2,115],73:[2,115],86:[2,115],87:[2,115],88:[2,115],94:[2,115],95:[2,115],98:[2,115],99:[2,115],103:[2,115],104:[2,115]},{13:[2,65],65:[2,65],66:[2,65],70:[2,65],72:[2,65],75:[2,65],85:[2,65],87:[2,65],88:[2,65],96:[2,65],99:[2,65],112:[2,65]},{13:[2,97],65:[2,97],66:[2,97],70:[2,97],72:[2,97],75:[2,97],85:[2,97],87:[2,97],88:[2,97],96:[2,97],99:[2,97],112:[2,97]},{13:[2,98],65:[2,98],66:[2,98],70:[2,98],72:[2,98],75:[2,98],85:[2,98],87:[2,98],88:[2,98],96:[2,98],99:[2,98],112:[2,98]},{13:[2,105],65:[2,105],66:[2,105],70:[2,105],72:[2,105],75:[2,105],85:[2,105],87:[2,105],88:[2,105],96:[2,105],99:[2,105],112:[2,105]},{13:[2,106],65:[2,106],66:[2,106],70:[2,106],72:[2,106],75:[2,106],85:[2,106],87:[2,106],88:[2,106],96:[2,106],99:[2,106],112:[2,106]},{87:[1,82],96:[1,81],99:[1,83]},{13:[2,108],65:[2,108],66:[2,108],70:[2,108],72:[2,108],75:[2,108],85:[2,108],87:[2,108],88:[2,108],96:[2,108],99:[2,108],112:[2,108]},{2:[2,110],6:[2,110],13:[2,110],18:[2,110],36:[2,110],65:[2,110],66:[2,110],70:[2,110],72:[2,110],75:[2,110],85:[2,110],87:[2,110],88:[2,110],96:[2,110],99:[2,110],109:[2,110],112:[2,110]},{13:[2,134],15:[2,134],65:[2,134],66:[2,134],70:[2,134],72:[2,134],75:[2,134],85:[2,134],87:[2,134],88:[2,134],96:[2,134],99:[2,134],112:[2,134]},{13:[2,135],15:[2,135],65:[2,135],66:[2,135],70:[2,135],72:[2,135],75:[2,135],85:[2,135],87:[2,135],88:[2,135],96:[2,135],99:[2,135],112:[2,135]},{67:[1,84]},{2:[2,74],6:[2,74],11:[2,74],13:[2,74],15:[2,74],18:[2,74],34:[2,74],36:[2,74],67:[2,74],68:[2,74],73:[2,74],85:[2,74],86:[2,74],87:[2,74],88:[2,74],94:[2,74],95:[2,74],96:[2,74],98:[2,74],99:[2,74],103:[2,74],104:[2,74],112:[2,74]},{13:[1,62],29:57,39:59,47:29,71:[1,85],81:58,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,108:86,109:[1,60],110:61,112:[1,26]},{13:[2,147],15:[2,147],23:[2,147],36:[2,147],71:[2,147],85:[2,147],87:[2,147],88:[2,147],94:[2,147],98:[2,147],99:[2,147],109:[2,147],112:[2,147]},{13:[2,149],15:[2,149],23:[2,149],36:[2,149],71:[2,149],85:[2,149],87:[2,149],88:[2,149],94:[2,149],98:[2,149],99:[2,149],109:[2,149],112:[2,149]},{13:[2,150],15:[2,150],23:[2,150],36:[2,150],71:[2,150],85:[2,150],87:[2,150],88:[2,150],94:[2,150],98:[2,150],99:[2,150],109:[2,150],112:[2,150]},{13:[2,151],15:[2,151],23:[2,151],36:[2,151],71:[2,151],85:[2,151],87:[2,151],88:[2,151],94:[2,151],98:[2,151],99:[2,151],109:[2,151],112:[2,151]},{13:[2,152],15:[2,152],23:[2,152],36:[2,152],71:[2,152],85:[2,152],87:[2,152],88:[2,152],94:[2,152],98:[2,152],99:[2,152],109:[2,152],112:[2,152]},{13:[2,153],15:[2,153],23:[2,153],36:[2,153],71:[2,153],85:[2,153],87:[2,153],88:[2,153],94:[2,153],98:[2,153],99:[2,153],109:[2,153],112:[2,153]},{13:[1,62],15:[1,69],29:57,32:87,36:[1,74],39:59,47:29,81:90,85:[1,63],87:[1,28],88:[1,30],93:[1,73],97:72,98:[1,71],99:[1,27],101:25,102:70,103:[1,51],104:[1,52],107:88,108:89,109:[1,60],110:61,112:[1,26]},{86:[1,75]},{73:[1,91]},{76:[1,92]},{2:[1,95],6:[1,93],13:[1,100],20:96,27:94,28:97,29:98,32:99,38:[1,101],39:59,41:[1,102],42:[1,103],47:29,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{15:[1,104],36:[1,105]},{15:[1,106]},{2:[2,123],6:[2,123],11:[2,123],13:[2,123],15:[2,123],18:[2,123],23:[2,123],34:[2,123],36:[2,123],67:[2,123],68:[2,123],71:[2,123],73:[2,123],85:[2,123],86:[2,123],87:[2,123],88:[2,123],94:[2,123],95:[2,123],96:[2,123],98:[2,123],99:[2,123],103:[2,123],104:[2,123],109:[2,123],112:[2,123]},{15:[1,107],36:[1,108]},{15:[1,109]},{15:[1,110]},{15:[1,111]},{15:[2,127],36:[2,127]},{2:[2,124],6:[2,124],11:[2,124],13:[2,124],15:[2,124],18:[2,124],23:[2,124],34:[2,124],36:[2,124],67:[2,124],68:[2,124],71:[2,124],73:[2,124],85:[2,124],86:[2,124],87:[2,124],88:[2,124],94:[2,124],95:[2,124],96:[2,124],98:[2,124],99:[2,124],103:[2,124],104:[2,124],109:[2,124],112:[2,124]},{36:[1,113],86:[1,112]},{15:[2,94],36:[2,94],86:[2,94]},{13:[1,37],35:114,43:41,49:34,53:38,87:[1,40],88:[1,42],99:[1,39],100:36,105:35,106:33},{2:[2,141],6:[2,141],11:[2,141],13:[2,141],15:[2,141],18:[2,141],34:[2,141],36:[2,141],67:[2,141],68:[2,141],71:[2,141],73:[2,141],86:[2,141],87:[2,141],88:[2,141],94:[2,141],95:[2,141],98:[2,141],99:[2,141],103:[2,141],104:[2,141]},{15:[1,115]},{94:[1,116]},{94:[1,117]},{94:[1,118]},{5:119,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{5:120,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{13:[2,148],15:[2,148],23:[2,148],36:[2,148],71:[2,148],85:[2,148],87:[2,148],88:[2,148],94:[2,148],98:[2,148],99:[2,148],109:[2,148],112:[2,148]},{15:[1,121],36:[1,122]},{15:[2,144],23:[2,144],36:[2,144],71:[2,144],94:[2,144],98:[2,144]},{15:[2,145],23:[2,145],36:[2,145],71:[2,145],94:[2,145],98:[2,145]},{13:[1,62],15:[2,150],23:[2,150],29:57,31:123,36:[2,150],39:59,47:29,71:[2,150],81:58,85:[1,63],87:[1,28],88:[1,30],94:[2,150],98:[2,150],99:[1,27],101:25,108:56,109:[1,60],110:61,112:[1,26]},{4:[1,124]},{5:125,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{2:[2,14],6:[2,14],18:[2,14],76:[2,14]},{2:[1,127],6:[1,126],18:[1,128]},{6:[1,129]},{2:[2,19],6:[2,19],18:[2,19]},{2:[2,20],6:[2,20],18:[2,20]},{13:[1,62],23:[1,134],29:57,30:130,31:131,34:[1,132],36:[1,133],39:59,47:29,81:58,85:[1,63],87:[1,28],88:[1,30],94:[2,149],98:[2,149],99:[1,27],101:25,108:56,109:[1,60],110:61,112:[1,26]},{33:135,94:[1,136],98:[1,50]},{13:[1,62],15:[1,69],29:57,32:137,36:[1,74],39:59,47:29,81:90,85:[1,63],87:[1,28],88:[1,30],93:[1,73],97:72,98:[1,71],99:[1,27],101:25,102:70,103:[1,51],104:[1,52],107:88,108:89,109:[1,60],110:61,112:[1,26]},{39:138,112:[1,26]},{39:139,112:[1,26]},{39:140,112:[1,26]},{2:[2,88],6:[2,88],11:[2,88],13:[2,88],15:[2,88],18:[2,88],34:[2,88],36:[2,88],67:[2,88],68:[2,88],73:[2,88],85:[2,88],86:[2,88],87:[2,88],88:[2,88],94:[2,88],95:[2,88],96:[2,88],98:[2,88],99:[2,88],103:[2,88],104:[2,88],112:[2,88]},{5:77,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],84:141,85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{2:[2,132],6:[2,132],11:[2,132],13:[2,132],15:[2,132],18:[2,132],34:[2,132],36:[2,132],67:[2,132],68:[2,132],73:[2,132],85:[2,132],86:[2,132],87:[2,132],88:[2,132],94:[2,132],95:[2,132],96:[2,132],98:[2,132],99:[2,132],103:[2,132],104:[2,132],112:[2,132]},{2:[2,125],6:[2,125],11:[2,125],13:[2,125],15:[2,125],18:[2,125],23:[2,125],34:[2,125],36:[2,125],67:[2,125],68:[2,125],71:[2,125],73:[2,125],85:[2,125],86:[2,125],87:[2,125],88:[2,125],94:[2,125],95:[2,125],96:[2,125],98:[2,125],99:[2,125],103:[2,125],104:[2,125],109:[2,125],112:[2,125]},{15:[2,128],36:[2,128]},{2:[2,130],6:[2,130],11:[2,130],13:[2,130],15:[2,130],18:[2,130],23:[2,130],34:[2,130],36:[2,130],67:[2,130],68:[2,130],71:[2,130],73:[2,130],85:[2,130],86:[2,130],87:[2,130],88:[2,130],94:[2,130],95:[2,130],96:[2,130],98:[2,130],99:[2,130],103:[2,130],104:[2,130],109:[2,130],112:[2,130]},{2:[2,121],6:[2,121],11:[2,121],13:[2,121],15:[2,121],18:[2,121],23:[2,121],34:[2,121],36:[2,121],67:[2,121],68:[2,121],71:[2,121],73:[2,121],85:[2,121],86:[2,121],87:[2,121],88:[2,121],94:[2,121],95:[2,121],96:[2,121],98:[2,121],99:[2,121],103:[2,121],104:[2,121],109:[2,121],112:[2,121]},{2:[2,119],6:[2,119],11:[2,119],13:[2,119],15:[2,119],18:[2,119],23:[2,119],34:[2,119],36:[2,119],67:[2,119],68:[2,119],71:[2,119],73:[2,119],85:[2,119],86:[2,119],87:[2,119],88:[2,119],94:[2,119],95:[2,119],96:[2,119],98:[2,119],99:[2,119],103:[2,119],104:[2,119],109:[2,119],112:[2,119]},{2:[2,92],6:[2,92],11:[2,92],13:[2,92],15:[2,92],18:[2,92],34:[2,92],36:[2,92],67:[2,92],68:[2,92],73:[2,92],85:[2,92],86:[2,92],87:[2,92],88:[2,92],94:[2,92],95:[2,92],96:[2,92],98:[2,92],99:[2,92],103:[2,92],104:[2,92],112:[2,92]},{5:142,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{2:[2,140],6:[2,140],11:[2,140],15:[2,140],18:[2,140],34:[2,140],36:[2,140],67:[2,140],68:[2,140],73:[2,140],86:[2,140],94:[2,140],95:[2,140],98:[2,140],103:[2,140],104:[2,140]},{2:[2,138],6:[2,138],11:[2,138],13:[2,138],15:[2,138],18:[2,138],34:[2,138],36:[2,138],67:[2,138],68:[2,138],71:[2,138],73:[2,138],86:[2,138],87:[2,138],88:[2,138],94:[2,138],95:[2,138],98:[2,138],99:[2,138],103:[2,138],104:[2,138]},{13:[2,107],65:[2,107],66:[2,107],70:[2,107],72:[2,107],75:[2,107],85:[2,107],87:[2,107],88:[2,107],96:[2,107],99:[2,107],112:[2,107]},{13:[2,109],65:[2,109],66:[2,109],70:[2,109],72:[2,109],75:[2,109],85:[2,109],87:[2,109],88:[2,109],96:[2,109],99:[2,109],112:[2,109]},{2:[2,111],6:[2,111],13:[2,111],18:[2,111],36:[2,111],65:[2,111],66:[2,111],70:[2,111],72:[2,111],75:[2,111],85:[2,111],87:[2,111],88:[2,111],96:[2,111],99:[2,111],109:[2,111],112:[2,111]},{68:[1,143]},{2:[2,70],6:[2,70],11:[2,70],15:[2,70],18:[2,70],34:[2,70],36:[2,70],67:[2,70],68:[2,70],73:[2,70],86:[2,70],94:[2,70],95:[2,70],98:[2,70],103:[2,70],104:[2,70]},{13:[2,154],15:[2,154],23:[2,154],36:[2,154],71:[2,154],85:[2,154],87:[2,154],88:[2,154],94:[2,154],98:[2,154],99:[2,154],109:[2,154],112:[2,154]},{13:[1,62],29:57,32:145,39:59,47:29,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,111:144,112:[1,26]},{13:[1,62],15:[2,146],23:[2,146],29:57,36:[2,146],39:59,47:29,71:[2,146],81:58,85:[1,63],87:[1,28],88:[1,30],94:[2,146],98:[2,146],99:[1,27],101:25,108:86,109:[1,60],110:61,112:[1,26]},{13:[1,62],29:57,32:148,39:59,47:29,74:146,78:147,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{2:[2,72],6:[2,72],11:[2,72],15:[2,72],18:[2,72],34:[2,72],36:[2,72],67:[2,72],68:[2,72],73:[2,72],86:[2,72],94:[2,72],95:[2,72],98:[2,72],103:[2,72],104:[2,72]},{2:[2,15],6:[2,15],18:[2,15],76:[2,15]},{6:[1,149]},{13:[1,100],20:150,28:97,29:98,32:99,38:[1,101],39:59,41:[1,102],42:[1,103],47:29,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{2:[2,16],6:[2,16],18:[2,16],76:[2,16]},{2:[2,21],6:[2,21],18:[2,21]},{13:[1,62],23:[1,134],29:57,30:151,39:59,47:29,81:58,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,108:86,109:[1,60],110:61,112:[1,26]},{13:[1,37],35:152,43:41,49:34,53:38,87:[1,40],88:[1,42],99:[1,39],100:36,105:35,106:33},{13:[1,155],29:154,37:153,99:[1,27]},{5:156,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{13:[1,62],29:57,32:157,39:59,47:29,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{99:[1,83]},{15:[1,121],33:158,36:[1,122],94:[1,136],98:[1,50]},{33:161,40:159,91:160,92:162,93:[1,164],94:[1,163],98:[1,50]},{33:161,40:165,91:160,92:162,93:[1,164],94:[1,163],98:[1,50]},{33:161,40:166,91:160,92:162,93:[1,164],94:[1,163],98:[1,50]},{15:[1,167],36:[1,113]},{15:[2,93],36:[2,93],86:[2,93]},{5:168,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{15:[1,169],36:[1,170]},{15:[2,157],36:[2,157]},{6:[1,171],18:[1,172]},{6:[2,78],18:[2,78]},{71:[1,173]},{2:[2,17],6:[2,17],18:[2,17],76:[2,17]},{2:[2,18],6:[2,18],18:[2,18]},{2:[2,22],6:[2,22],18:[2,22]},{2:[2,25],6:[2,25],18:[2,25]},{34:[1,174],36:[1,175]},{34:[2,76],36:[2,76]},{98:[1,71]},{2:[2,27],6:[2,27],11:[1,176],18:[2,27]},{23:[1,134],30:177},{13:[1,62],29:57,32:178,39:59,47:29,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{2:[2,29],6:[2,29],18:[2,29],36:[1,179]},{2:[2,100],6:[2,100],18:[2,100],36:[2,100]},{2:[2,101],6:[2,101],18:[2,101],36:[2,101]},{2:[2,102],6:[2,102],18:[2,102],36:[2,102]},{88:[1,180],99:[1,83]},{2:[2,103],6:[2,103],18:[2,103],36:[2,103]},{2:[2,30],6:[2,30],18:[2,30],36:[1,179]},{2:[2,31],6:[2,31],18:[2,31],36:[1,179]},{2:[2,91],6:[2,91],11:[2,91],13:[2,91],15:[2,91],18:[2,91],34:[2,91],36:[2,91],67:[2,91],68:[2,91],73:[2,91],85:[2,91],86:[2,91],87:[2,91],88:[2,91],94:[2,91],95:[2,91],96:[2,91],98:[2,91],99:[2,91],103:[2,91],104:[2,91],112:[2,91]},{2:[2,68],6:[2,68],11:[2,68],15:[2,68],18:[2,68],34:[2,68],36:[2,68],67:[2,68],68:[2,68],73:[2,68],86:[2,68],94:[2,68],95:[2,68],98:[2,68],103:[2,68],104:[2,68]},{13:[2,155],15:[2,155],23:[2,155],36:[2,155],71:[2,155],85:[2,155],87:[2,155],88:[2,155],94:[2,155],98:[2,155],99:[2,155],109:[2,155],112:[2,155]},{13:[1,62],29:57,32:181,39:59,47:29,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{2:[2,71],6:[2,71],11:[2,71],15:[2,71],18:[2,71],34:[2,71],36:[2,71],67:[2,71],68:[2,71],73:[2,71],86:[2,71],94:[2,71],95:[2,71],98:[2,71],103:[2,71],104:[2,71]},{13:[1,62],29:57,32:148,39:59,47:29,78:182,81:90,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,107:88,108:89,109:[1,60],110:61,112:[1,26]},{5:183,13:[2,67],61:4,62:5,65:[2,67],66:[2,67],70:[2,67],72:[2,67],75:[2,67],85:[2,67],87:[2,67],88:[2,67],96:[2,67],99:[2,67],112:[2,67]},{13:[1,37],35:184,43:41,49:34,53:38,87:[1,40],88:[1,42],99:[1,39],100:36,105:35,106:33},{13:[1,155],29:185,99:[1,27]},{4:[1,66],26:186},{2:[2,23],6:[2,23],18:[2,23]},{15:[1,187]},{33:161,91:188,92:162,93:[1,164],94:[1,163],98:[1,50]},{94:[1,189]},{15:[2,156],36:[2,156]},{6:[2,77],18:[2,77]},{6:[2,79],18:[2,79]},{2:[2,26],6:[2,26],18:[2,26]},{34:[2,75],36:[2,75]},{2:[2,28],6:[2,28],18:[2,28]},{13:[1,62],29:57,31:190,39:59,47:29,81:58,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,108:56,109:[1,60],110:61,112:[1,26]},{2:[2,99],6:[2,99],18:[2,99],36:[2,99]},{2:[2,104],6:[2,104],18:[2,104],36:[2,104]},{13:[1,62],23:[1,134],29:57,30:191,39:59,47:29,81:58,85:[1,63],87:[1,28],88:[1,30],99:[1,27],101:25,108:86,109:[1,60],110:61,112:[1,26]},{2:[2,24],6:[2,24],18:[2,24]}],
defaultActions: {31:[2,1]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = JSHCparserExp;
exports.parse = function () { return JSHCparserExp.parse.apply(JSHCparserExp, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require('fs').readFileSync(require('path').join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}

// --- src/Parser/parse.js ---
//require Parser/tokenize.js
//        Parser/preL.js
//        Parser/iterL.js
//        Parser/parser.js
         
JSHC.ParseError = function(msg,pos){
  this.msg = msg;
  this.pos = pos;
};

JSHC.ParseError.prototype.toString = function(){
  return this.msg;
};
 
JSHC.parse = function(input) {
    var x = JSHC.Parser.tokenize.parse(input);
    var y = JSHC.Parser.preL(x);
    JSHCparser.lexer = new iterL();
    JSHCparser.yy.parseError = function (str, hash) {
        if (JSHCparser.yy.lexer.debugArr !== undefined)
            console.log("parse error happened, lexer has so far returned:<br>" + JSHCparser.yy.lexer.debugArr)
        if (!JSHCparser.yy.lexer.parseError()) {
            throw new JSHC.ParseError(str + " expected: " + hash.expected +
                                 "<br>Lexer returned: " + JSHCparser.yy.lexer.recent,
                                  JSHCparser.yy.lexer.yylloc);
        } 
    }
    var res = JSHCparser.parse(y);
//    try {
//    alert(JSHC.showAST(res));
//    } catch (err) {
//        alert(JSHC.showError(err))
//    }
    return res;
}



// --- src/Parser/parseExp.js ---
//require Parser/tokenize.js
//        Parser/preL.js
//        Parser/iterL.js
//        Parser/parser.js
         
JSHC.ParseError = function(msg,pos){
  this.msg = msg;
  this.pos = pos;
};

JSHC.ParseError.prototype.toString = function(){
  return this.msg;
};
 
JSHC.parseExp = function(input) {
    var x = JSHC.Parser.tokenize.parse(input);
    var y = JSHC.Parser.preL(x);
    JSHCparserExp.lexer = new iterL();
    JSHCparserExp.yy.parseError = function (str, hash) {
        if (!JSHCparserExp.yy.lexer.parseError()) {
            throw new JSHC.ParseError(str + " expected: " + hash.expected +
                                 "<br>Lexer returned: " + JSHCparserExp.yy.lexer.recent,
                                  JSHCparserExp.yy.lexer.yylloc);
        } 
    }
    var res = JSHCparserExp.parse(y);
    return res;
}



// --- src/Check/nameCheck.js ---

if( JSHC.Check === undefined)JSHC.Check = {};

////////////////////////////////////////////////////////////////////////////////
// NAME CHECK

/*
produces errors for missing idents.
keeps track of identifiers in scope.
qualifies all top-level names that are used. local names are not qualified.
*/

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.nameCheck = function(comp,module) {

    // call checkNames on module. handles all parts of AST recursively.
    JSHC.Check.nameCheckModule(comp,module);
};

////////////////////////////////////////////////////////////////////////////////

/*
  Checks the possible names that the given name can refer to.
  if there is exactly one match, the name is qualified using the found name,
  and the found name is returned.
  
  comp: the compiler
  module: the current module
  lspace: either the lspace or null
  name: the name to look up
*/
JSHC.Check.lookupName = function(comp,module,lspace,name){
    assert.ok( comp !== undefined );
    assert.ok( module !== undefined );
    assert.ok( lspace !== undefined );
    assert.ok( name !== undefined );
    var i;
    var nspace = new JSHC.Set(true,"toStringQ");  // namespace to put all referenced names into
    var loc = "";

    // check if in lspace
    if( name.loc === undefined ){
        // handle unqualified name

        // if an lspace exists, then search it.
        if( lspace !== null ){
            var lname = lspace.lookup(name);
            assert.ok( lname !== null, "the lspace is not storing the value for name "+name );
            if( lname !== undefined ) {
                //JSHC.alert("found ",name," as ",lspace.lookup(name));
                lname.isLocal = true;
                nspace.add(lname);
            }
        }
    } 

    var hasLocals = function(ns) {
        var vals = ns.getValues();

        for (var i = 0; i < vals.length; i++) {
            if (vals[i].isLocal !== undefined) {
                return vals[i].isLocal;
            }
        }
        return false;
    }

    // check if in tspace
    if( (name.loc === undefined || name.loc === module.modid.id) && !hasLocals(nspace) ){
        // handle unqualified name or qualified with the module it is within

        var name_in_tspace = module.body.tspace[name];
        if( name_in_tspace !== undefined ){
            // add top-level (currently non-qualified) name
            //ns[name] = {name: module.body.tspace[name], src: module.modid};
	    nspace.add(name_in_tspace);
        }
    }

    // check impdecls
    if( (name.loc === undefined || name.loc !== module) && !hasLocals(nspace) ){
        // handle unqualified name or qualified with import module name

        var impdecls = module.body.impdecls;
        for(i=0;i<impdecls.length;i++){
            var impdecl = impdecls[i];
            var exports = comp.modules[impdecl.modid].ast.espace;

            //if( module.modid.id == "interact+" ){
            //    JSHC.alert("impdecl: ",impdecl.modid.id,"\nexports: ",JSHC.showKeys(exports));
            //    JSHC.alert("found?: ",exports[name]);
            //}

            // if the name was qualified and the qualification does not match the
            // import declaration, then skip it.
            if( name.loc !== undefined && impdecl.modid.id !== name.loc ){
                continue;
            }

	    var inames = impdecl.imports;
	    var exp = exports[name];

	    // check if exported and imported accoring to the import list.
            if( exp !== undefined && JSHC.Check.isImported(exp,impdecl,name) ){
	        nspace.add(exp);
	    }
        }
    }

    amount = nspace.size();
    if( amount === 0 ){
	// error: name not in scope
	//make sure our internal functions pass the checks
	var internal = "JSHC.Internal"
	if( name.loc !== undefined && name.loc.substr(0,internal.length) === internal ){
	    return undefined;
	}
	if( name.id == "[]" ){
	    return undefined;
	}
	if( name.id == ":" && name.isSymbol === true ){
	    name.fixity = {fix: "rightfix", prec: 5};
	    return undefined;
	}
//	JSHC.alert(lspace, nameobj, nspace, module.body.tspace)
//	alert("LSPACE:\n\n"+JSHC.showAST(lspace))
//	alert("name:\n\n"+JSHC.showAST(name))
//	alert("nspace:\n\n"+JSHC.showAST(nspace))
//	alert("tspace:\n\n"+JSHC.showAST(module.body.tspace))
//	alert("LSPACE:\n\n"JSHC.showAST(lspace))
        comp.onError(new JSHC.SourceError(module.modid, name.pos, name.toStringQ()+" not in scope"));
        //if( comp.errors > 0 )assert.ok( false );
    } else if( amount === 1 ){
        // declared in one location (topdecl or import)
        var matched_name = nspace.getAny();
        if( matched_name.loc !== undefined ){

	    // if name is not qualified and referring to a qualified name,
	    // then qualify it so that it has the same qualification.
            if( name.loc === undefined ){
	        name.loc = matched_name.loc;
	        if (name.fixity === undefined) {
	            name.fixity = matched_name.fixity;
	        }
	    }

	    return matched_name; // always return the found name when qualified
	}
    } else { // amount.length >= 2
	// error: ambiguity since more than one declaration in scope
	msg = ["Ambiguity. Names in scope: "];
        
        msg = msg.concat(nspace.getKeys());

	comp.onError(new JSHC.SourceError(module.modid,name.pos,msg.join(" ")));
    }
    return undefined;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.isImported = function(exp,impdecl,name){
    if( impdecl.imports === undefined ){   // importing everything
	return true;
    } else {
	var inList = JSHC.Check.isInImportList(exp,impdecl.imports,name);
	if( inList && !impdecl.hiding ){
	    return true;
	} else if( !inList && impdecl.hiding ){
	    return true;
	}
	return false;
    }
};

/*
  check if a name is in the import list of an import declaration.
 */
JSHC.Check.isInImportList = function(exp,inames,name){
    var j;

    for(j=0;j<inames.length;j++){
	if( inames[j].name === "import-var" ){
	    return inames[j].varname.equal(name);
	} else if( inames[j].name === "import-tycon" ){
	    // if importing tycon, then return it
	    if( inames[j].tycon.equal(name) ){
		return true;
	    }

	    // check if importing one if the data constructors.
	    var dacons = inames[j].list;
	    if( dacons === undefined ){
		if( inames[j].all ){
		    // all data constructors imported
		    return exp.memberOf === inames[j].tycon.id;
		} else {
		    // no data constructors imported
		    return false;
		}
	    } else {
		// some data constructors imported
		assert.ok( inames[j].all === false );

		// check if dacon is in the list.
		for(k=0;k<dacons.length;k++){
		    if( exp.equal(dacons[k]) ){
			return true;
		    }
		}
		return false;
	    }
	}
    }
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.nameCheckModule = function(comp,ast){
    var i;

    // no export specification, so export all top-level declarations
    if( ast.espace === undefined && ast.exports === undefined ){
        ast.espace = {};  // new empty namespace for all exports
        for(var name in ast.body.tspace){
            ast.espace[name] = ast.body.tspace[name];
        }
    }

    // check imports and topdecls
    JSHC.Check.nameCheckBody(comp, ast, ast.body);

    // check export specification if it exists
    if( ast.exports !== undefined ){
        ast.espace = {};  // new empty namespace for all exports
        for(i=0;i<ast.exports.length;i++){
            JSHC.Check.nameCheckExport(comp,ast,ast.exports[i]);
        }
    }
};

JSHC.Check.nameCheckExport = function(comp,module,ast){

    switch( ast.name ){
    case "export-qvar":
    case "export-type-unspec":
        var ref = JSHC.Check.lookupName(comp,module,null,ast.exp);
        if( module.espace[ref] === undefined ){
            module.espace[ref] = ref;
        } else {
            comp.onError(new SourceError(module.modid, ast.exp.pos, ast.exp + " already exported."));
            // TODO: refer to position of previous declaration
        }
        break;

    case "export-type-all":
        var ref = JSHC.Check.lookupName(comp,module,null,ast.exp);
        module.espace[ref] = ref;

        var decl = JSHC.Check.lookupDatatype(comp,module,ast.exp);
        for(i=0;i<decl.constrs.length;i++){
            // TODO: check if already exported
            //       refer to position of previous declaration in case
            //       of error.
            var dacon = decl.constrs[i].dacon;
            module.espace[dacon] = dacon;
        }
        break;

    case "export-type-vars":
        var ref = JSHC.Check.lookupName(comp,module,null,ast.exp);
        module.espace[ref] = ref;

        // find the datatype declaration and add the listed members.
        // produce error if not in datatype declaration.
        decl = JSHC.Check.lookupDatatype(comp,module,ast.exp);
        var dacons = {};
        for(i=0;i<decl.constrs.length;i++){
            dacons[decl.constrs[i].dacon] = decl.constrs[i].dacon;
        }
        for(i=0;i<ast.vars.length;i++){
            if( dacons[ast.vars[i].toStringN()] === undefined ){
                this.errors.push(new SourceError(this.module.modid, ast.vars[i].pos, ast.vars[i] + " not in datatype"));
            } else {
                module.espace[ast.vars[i]] = ast.vars[i];
                ast.vars[i].loc = module.modid.id;
            }
        }
        break;

    default:
        throw new JSHC.CompilerError("missing export case:"+ast.name);
    }
};

JSHC.Check.lookupDatatype = function(comp,module,tycon){
    var i;
    var ts = module.body.topdecls;
    for(i=0;i<ts.length;i++){
	if( ts[i].name !== "topdecl-data" || !ts[i].typ.tycon.equal(tycon) ){
	    continue;
	}
	return ts[i];
    };
    throw new JSHC.SourceError("Type not found", tycon.pos, "Module " + module.modid.toString() + " failed to export type " + tycon.id + ": not in scope.");
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.nameCheckBody = function(comp,module,ast){
    var i;

    for(i=0 ; i<ast.impdecls.length ;){
        var id = ast.impdecls[i].modid.id;
        if( id == module.modid.id ){
            // self import
            if( id !== "Prelude" ){
                //comp.onWarning(new SourceError(imp.modid.id, imp.pos, "self imports have no effect");
            }
            // delete self import
            ast.impdecls.splice(i,1);
        } else {
            i++;
        }
    }

    // check impdecls
    for(i=0 ; i<ast.impdecls.length ; i++){
	JSHC.Check.nameCheckImpdecl(comp,module,ast.impdecls[i]);
    }

    // check topdecls
    for(i=0 ; i<ast.topdecls.length ; i++){
	JSHC.Check.nameCheckTopdecl(comp,module,ast.topdecls[i]);
    }
};


JSHC.Check.nameCheckImpdecl = function(comp,module,imp){
    var j,k,l;

    var exports = comp.modules[imp.modid];
    if( exports === undefined ){
	// this should be impossible if compilation stops when parsing of any
	// module fails.
	//errors.push(new SourceError(module.modid.id, imp.pos, "imported module not available"));
	JSHC.alert("missing module. looking for: ",imp.modid);
	for(var module in comp.modules){
	    JSHC.alert("has: ",module);
	}
	throw new JSHC.CompilerError("A module being dependent upon is missing.");
    }
    
    //if a module exports everything, that's what it does, so no need to check
    if (imp.imports === undefined)
        return;
            
    var inames = imp.imports;
    for(j=0;j<inames.length;j++){
	if( inames[j].name === "import-var" ){
	    if( exports.containsVar(inames[j].varid.id) === false ){
		comp.onError(new SourceError(module.modid.id, inames[j].varid.pos, "variable not exported by module " + imp.modid.id));
	    }
	} else if( inames[j].name === "import-tycon" ){
	    if( exports.containsTycon(inames[j].tycon.id) === false ){
		comp.onError(new SourceError(module.modid.id, inames[j].varid.pos, "type constructor not exported by module " + imp.modid.id));
	    } else {
		var datatype = exports.lookupTycon(inames[j].tycon.id);
		var dacons = inames[j].list;
		if( dacons !== undefined ){
		    for(k=0;k<dacons.length;k++){
			// check if exported datatype contains the data constructor
			for(l=0;l<datatype.constrs.length;l++){
			    if( datatype.constrs[l].id === dacons[k].id ){
				comp.onError(new SourceError(module.modid.id, inames[j].varid.pos, "data constructor " + dacons[k].id + " not in datatype " + inames[j].tycon.id + " exported by module " + imp.modid.id));
			    }
			}
		    }
		}
	    }
	}
    }
};

JSHC.Check.nameCheckTopdecl = function(comp,module,ast){
    switch( ast.name ){
    case "topdecl-data":
        JSHC.Check.nameCheckTopdeclData(comp,module,ast);
        break;
    case "topdecl-decl":
        JSHC.Check.nameCheckTopdeclDecl(comp,module,ast.decl);
        break;
    default:
        throw new JSHC.CompilerError("missing topdecl case:"+ast.name);
    }
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.nameCheckTopdeclData = function(comp,module,ast){

    lspace = new JSHC.LSpace(true);

    lspace.withSpace(function(){

    // not adding type constructor (ast.typ.tycon) since in tspace

    // add type variables
    for(var i=0 ; i<ast.typ.vars.length ; i++){
	lspace.add(ast.typ.vars[i]);
    }

    // the check that data constructor names are not overlapping is done when
    // creating the tspace.
    for(var i=0 ; i<ast.constrs.length ; i++){
        var types = ast.constrs[i].types;
        
        // check the types given the type variables in the lspace
        for(var j=0 ; j<types.length ; j++){
            JSHC.Check.nameCheckType(comp,module,lspace,types[j]);
	}
    }

    });
};

JSHC.Check.nameCheckQType = function(comp,module,ast){
    switch( ast.name ){
    case "apptype":
        JSHC.Check.nameCheckQType(comp,module,ast.lhs);
        JSHC.Check.nameCheckQType(comp,module,ast.rhs);
        break;

    case "funtype":
        ast.types.forEach(function(t){
            JSHC.Check.nameCheckQType(comp,module,t);
        });
        break;

    case "tyvar":
        break;

    case "tycon":
        JSHC.Check.lookupName(comp,module,new JSHC.LSpace(),ast);
        break;

    default:
        throw new JSHC.CompilerError("missing type case:"+ast);
    }
};

JSHC.Check.nameCheckType = function(comp,module,lspace,ast){
    switch( ast.name ){
    case "apptype":
        JSHC.Check.nameCheckType(comp,module,lspace,ast.lhs);
        JSHC.Check.nameCheckType(comp,module,lspace,ast.rhs);
        break;

    case "funtype":
        ast.types.forEach(function(t){
            JSHC.Check.nameCheckType(comp,module,lspace,t);
        });
        break;

    case "tyvar":
    case "tycon":
        JSHC.Check.lookupName(comp,module,lspace,ast);
        break;

    default:
        throw new JSHC.CompilerError("missing type case:"+ast.name);
    }
};

JSHC.Check.nameCheckTopdeclDecl = function(comp,module,ast){
    switch( ast.name ){
    case "decl-fun":
        JSHC.Check.nameCheckDeclFun(comp, module, new JSHC.LSpace(true), ast);
        break;
    case "fixity":
        JSHC.Check.nameCheckFixity(comp,module,ast);
        break;
    case "type-signature":
        var empty_lspace = new JSHC.LSpace(true)
        for(var ix=0 ; ix<ast.vars.length ; ix++){
           JSHC.Check.nameCheckExp(comp,module,empty_lspace,ast.vars[ix]);
        }
        JSHC.Check.nameCheckQType(comp,module,ast.sig);
        break;
    default:
        throw new JSHC.CompilerError("missing decl case:"+ast.name);
    }
};

JSHC.Check.nameCheckLocalDecl = function(comp,module,lspace,ast){
    switch( ast.name ){
    case "decl-fun":
        JSHC.Check.nameCheckDeclFun(comp, module, lspace, ast);
        break;
    case "fixity":
        JSHC.Check.nameCheckFixity(comp,module,ast);
        break;
    default:
        throw new JSHC.CompilerError("missing decl case:"+ast.name);
    }
};

JSHC.Check.getLocalBindings = function(comp,module,lspace,ast){
    var decls = ast.decls;
    var names = {};
    var fix = {};
    
    for (var i = 0; i < decls.length; i++) {
        switch( decls[i].name ){
        case "decl-fun":
            names[decls[i].ident] = decls[i].ident;
            break;
        case "fixity":
            for (var j = 0; j < decls[j].ops.length; j++) {
                fix[ops[i]] = {fix: decls[i].fix, prec: decls[i].num.val};
            }
            break;
        default:
            throw new JSHC.CompilerError("missing decl case:"+ast.name);
        }
    }
    
    for (var k in fix) {
        if (names[k] !== undefined) {
            names[k].fixity = fix[k];
        }
    }
    
    for (var k in names) {
        lspace.add(names[k]);
    }
    
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.nameCheckDeclFun = function(comp,module,lspace,ast){
    var args = ast.args;
    lspace.push(); // add space for names in patterns
    JSHC.Check.nameCheckPatterns(comp,module,lspace,args);
    //JSHC.alert(ast,"\n\n",ast.rhs);
    JSHC.Check.nameCheckExp(comp,module,lspace,ast.rhs);
    lspace.pop();
};

//Check that fixity information is presented only of ops declared in this module.
JSHC.Check.nameCheckFixity = function (comp,module,ast) {
    var ops = ast.ops;
    var ts = module.body.tspace;
    for (var i = 0; i < ops.length; i++) {
        var def = ts[ops[i].toString()]
        if (def === undefined)
             throw new JSHC.CompilerError("operator " + ops[i].toString() + " not defined in the same module as fixity declaration");
    }
};

JSHC.Check.nameCheckPatterns = function(comp,module,lspace,patterns){
    // checks all patterns using the same set so that overlaps are detected.
    for(var i=0 ; i<patterns.length ; i++){
        JSHC.Check.nameCheckPattern(comp,module,lspace,patterns[i]);
    }
};

JSHC.Check.nameCheckPattern = function(comp,module,lspace,ast){
    switch( ast.name ) {
    case "dacon":
        JSHC.Check.lookupName(comp,module,lspace,ast);
        break;

    case "conpat":
        JSHC.Check.lookupName(comp,module,lspace,ast.con);
        for (var i = 0; i < ast.pats.length; i++) {
            JSHC.Check.nameCheckPattern(comp,module,lspace,ast.pats[i]);
        }
        break;

    case "varname":
        lspace.add(ast);
        break;

    case "wildcard":
    case "integer-lit":
        break;

    case "tuple_pat":
        for (var i = 0; i < ast.members.length; i++) {
            JSHC.Check.nameCheckPattern(comp, module, lspace, ast.members[i]);
        }
        break;

    default:
        throw new JSHC.CompilerError("missing pattern case:"+ast.name);
    }
};

JSHC.Check.nameCheckExp = function(comp,module,lspace,ast){
    switch( ast.name ){
    case "infixexp":
        for (var i = 0; i < ast.exps.length; i++) {
            JSHC.Check.nameCheckExp(comp,module,lspace,ast.exps[i]);
        }
        break;
        
    case "qop":
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.id);
        break;
        
    case "varname":
    case "dacon":
        JSHC.Check.lookupName(comp,module,lspace,ast);
        //JSHC.alert(ast.id," at ",ast.loc);
        break;
    
    case "application":
        for(var i=0 ; i<ast.exps.length ; i++){
            JSHC.Check.nameCheckExp(comp,module,lspace,ast.exps[i]);
        }
        break;

    case "ite":
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.e1);
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.e2);
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.e3);
        break;

    case "case":
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.exp);
        for (var i = 0; i < ast.alts.length; i++) {
            var alt = ast.alts[i];
            lspace.push();
            JSHC.Check.nameCheckPattern(comp,module,lspace,alt.pat);
            JSHC.Check.nameCheckExp(comp,module,lspace,ast.alts[i].exp);
            lspace.pop();
        }
        break;

    case "lambda":
        lspace.push();
        JSHC.Check.nameCheckPatterns(comp,module,lspace,ast.args);
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.rhs);
        lspace.pop();
        break;

    case "listexp":
    case "tuple":
        for(var i=0 ; i<ast.members.length ; i++){
            JSHC.Check.nameCheckExp(comp,module,lspace,ast.members[i]);
        }
        break;

    case "integer-lit":
        break;
    
    case "fun-where":
    case "let":
        lspace.push();
        JSHC.Check.getLocalBindings(comp,module,lspace,ast);
        for (var i = 0; i < ast.decls.length; i++) {
             JSHC.Check.nameCheckLocalDecl(comp,module,lspace,ast.decls[i]);
        
        }
        JSHC.Check.nameCheckExp(comp,module,lspace,ast.exp);
        lspace.pop();
        break; 
    
    default:
        throw new JSHC.CompilerError("missing exp case:"+ast.name + "\n" + JSHC.showAST(ast));
    }
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Check/typeCheck.js ---

if( JSHC.Check === undefined )JSHC.Check = {};

JSHC.Check.typeCheck = function(comp,modules){
    try{
        JSHC.Check.typeCheckModules(comp,modules);
    }catch(err){
        JSHC.alert("error in type checking\n",JSHC.showError(err));
    }
};

/*
  type check an array of modules
*/
JSHC.Check.typeCheckModules = function(comp,modules){
    assert.ok( modules instanceof Array );

/*
    // compute the set of locations which are being type checked
    var locations = {};
    for(var i=0 ; i<modules.length ; i++){
        var loc = modules[i].modid.toString();
        locations[loc] = null;
    }
*/

    var all_topdecls = [];
    for(var i=0 ; i<modules.length ; i++){
        var module = modules[i];
        
        var topdecls = module.body.topdecls;
        for(var ix=0 ; ix<topdecls.length ; ix++){
            all_topdecls.push(topdecls[ix]);
        }
    }

    var ctx = new JSHC.Check.Ctx();  // empty ctx at top-level

    JSHC.Check.typeCheckTopDeclsInDepOrder(comp,ctx,all_topdecls);
};

JSHC.Check.typeCheckTopDeclsInDepOrder = function(comp,ctx,topdecls){
    // compute the declared names for all decls
    // these are the names the decls can depend upon.
    dnames = {};
    for(var i=0 ; i<topdecls.length ; i++){
        var names = JSHC.Check.computeDeclaredNames(topdecls[i]);
        for(var n in names){
            dnames[n] = names[n];
        }
    }

    // map for the entries
    var entrymap = {};

    for(var i=0 ; i<topdecls.length ; i++){
        var topdecl = topdecls[i];

        //if the declaration is a fixity declaration, no typechecking needs to be done.
        if (topdecl.name === "topdecl-decl" && topdecl.decl.name === "fixity" ||
            topdecl.name === "fixity" ){
           continue;
        }

        var names = JSHC.Check.computeDeclaredNames(topdecls[i]);

        //   compute used names in dnames
        // previously used "computeUsedQualifiedNames"
        var deps = JSHC.Check.computeUsedNamesInDecl(dnames, topdecls[i]);

        //   make entry with declared names and used names
        var entry = new JSHC.Dep.Entry([topdecl],names,deps);
        //JSHC.alert("new entry: ",entry);
        for( var k in names ){
            var current_entry = entrymap[names[k]];
            //JSHC.alert("current keys: "+JSHC.showKeys(entrymap),"\ncurrent entry("+names[k]+"): ",current_entry);
            if( current_entry === undefined ){
                assert.ok( entry !== undefined );
                entrymap[names[k]] = entry;
            } else {
                // add declared names, used names, and values to the
                // existing entry.
                for( var l in names ){
                    current_entry.addName(names[l]);
                }
                for( var l in deps ){
                    current_entry.addIncoming(deps[l]);
                }
                current_entry.addValue(topdecl);
            }
        }
    }

    // create action for each group
    var action = function(entry){
        //JSHC.alert("type group (topdecls):",entry);

        // read module name from entry and pass along.
        JSHC.Check.typeCheckTopdeclsTogether(comp,entry.name.loc,ctx,entry.values);
    }

    // create and traverse groups in dependency order
    JSHC.Dep.check(entrymap,action);
};

JSHC.Check.typeCheckDeclsDep = function(topdecls,entrymap,locations) {

    for(var j=0 ; j<topdecls.length ; j++){
        var topdecl = topdecls[j];
        //if the declaration is a fixity declaration, no typechecking needs to be done.
        if (topdecl.name === "topdecl-decl" && topdecl.decl.name === "fixity")
           continue;
            
        var deps = JSHC.Check.computeUsedQualifiedNames(topdecl);
        for(var dep in deps){
            var loc = deps[dep].loc;
            // remove all used names which are NOT referring to any topdecl
            // in any of the modules being checked.
            if( locations[loc] === undefined ){
                delete deps[dep];
            }
        }
        var names = JSHC.Check.computeDeclaredQualifiedNames(topdecl);

        var entry = new JSHC.Dep.Entry([topdecl],names,deps);
        for( var k in names ){
            var current_entry = entrymap[names[k]];
            //JSHC.alert("current keys: "+JSHC.showKeys(entrymap),"\ncurrent entry("+names[k]+"): ",current_entry);
            if( current_entry === undefined ){
                assert.ok( entry !== undefined );
                entrymap[names[k]] = entry;
            } else {
                // add declared names, used names, and values to the
                // existing entry.
                for( var l in names ){
                    current_entry.addName(names[l]);
                }
                for( var l in deps ){
                    current_entry.addIncoming(deps[l]);
                }
                current_entry.addValue(topdecl);
            }
        }
    }
};
/*
JSHC.Check.typeCheckLocalDecls = function (comp, decls) {
    
    var entrymap = {};
    
    JSHC.Check.typeCheckDeclsDep(topdecls,entrymap);
    
    // create action for each group
    var action = function(entry){
        //JSHC.alert("type group (topdecls):",entry);

        // read module name from entry and pass along.
        JSHC.Check.typeCheckTopdeclsTogether(comp,entry.name.loc,entry.values);
    }

    // create and traverse groups in dependency order
    JSHC.Dep.check(entrymap,action);

};
*/
JSHC.Check.typeCheckTopdeclsTogether = function(comp,modid,ctx,topdecls){

    ctx.push();  // context with all declared names in the group

    // add type variables to names that are visible to all declarations
    // in the group.
    for(var ix=0 ; ix<topdecls.length ; ix++){
        var decl = topdecls[ix];
        if( decl.name == "topdecl-decl" ){
            decl = decl.decl;
        }
        if( decl.name == "decl-fun" ){
            var ident = decl.ident;
            // add the name once for all declarations of the same name
            if( ctx.isNameInCurrentContext(ident) == false ){
                ctx.add(ident);
            }
        }
    }

    //JSHC.alert("before checking the group:\n"+ctx.toString());

    // infer types
    for(var ix=0 ; ix<topdecls.length ; ix++){
        try {
	    JSHC.Check.checkTopdecl(comp,ctx,topdecls[ix]);
        } catch( err ){
            if( err instanceof JSHC.TypeConstraintError ){
                if( err.pos === undefined ){
                   err.pos = topdecls[ix].pos;
                }
                if( err.mname === undefined ){
                   err.mname = modid.id;
                }
                comp.onError(err);
            } else {
                throw err;
            }
        }
    }

    // quantify all decl types
    //JSHC.alert("before quantification:\n"+ctx.toString());

    var typemap = {};
    for(var ix=0 ; ix<topdecls.length ; ix++){
        var decl = topdecls[ix];
        if( decl.name == "topdecl-decl" ){
            decl = decl.decl;
        }
        if( decl.name == "decl-fun" ){
            var ident = decl.ident;
            if( ctx.isNameInCurrentContext(ident) ){
                typemap[ident] = ctx.quantify(ident);
                ctx.rem(ident);
            }
            // for all names, write the type to each name in the decl
            ident.type = typemap[ident];
        }
    }

    // constrain using type signature
    for(var ix=0 ; ix<topdecls.length ; ix++){
        var decl = topdecls[ix];
        if( decl.name == "topdecl-decl" ){
            decl = decl.decl;
        }
        if( decl.name == "type-signature" ){
            try {
                //if( ctx.lookupTypeUnmodified(comp,ident) === undefined ){
                //    comp.onError("type signature but not binding for "+decl.ident+".");
                //}

                // quantify type
                decl.sig = ctx.quantifyType(decl.sig);
                // check kind
                var kind = JSHC.Check.checkType(comp,ctx,decl.sig);
                // constrain kind to "*"
                ctx.constrainValue(decl.sig, kind, JSHC.Check.StarKind);

                // constrain type for each ident
                for( var ix=0 ; ix<decl.vars.length ; ix++ ){
                    ctx.constrainValue(decl.vars[ix], ctx.lookupTypeUnmodified(comp,decl.vars[ix]), decl.sig);
                }
                //JSHC.alert(ctx.toString());


            } catch( err ){
                if( err instanceof JSHC.TypeConstraintError ){
                    if( err.pos === undefined ){
                       err.pos = decl.pos;
                    }
                    if( err.mname === undefined ){
                       err.mname = modid.id;
                    }
                    comp.onError(err);
                } else {
                    throw err;
                }
            }
        }
    }

    //JSHC.alert("after quantification:\n"+ctx.toString());

    ctx.pop();
};

JSHC.Check.checkTopdecl = function(comp,ctx,ast){
  switch( ast.name ){
  case "topdecl-decl":
     JSHC.Check.checkTopdecl(comp,ctx,ast.decl);
     break;

  case "decl-fun":

         var rhs_type = JSHC.Check.checkExpPattern(comp,ctx,ast.args,ast.rhs);

	 //var e_ident_type = [].concat(params_tv);
	 //e_ident_type.push(rhs_type);
	 //e_ident_type = new JSHC.FunType(e_ident_type);

	 // free the type variables <ident_tv> and <params_tv>.
	 //for(ix in params_tv){
	 //    ctx.freeTyVar(params_tv[ix]);
	 //}
	 //ctx.freeTyVar(ident_tv);

	 // quantify the remaining free type variables used by the params to
	 // produce the decl type.
	 //ident.type = ctx.quantify(ident);

	 // removes the names that are no longer needed and will not be
	 // quantified. this should free all remaining type variables in the
	 // current tyvar context.
	 //for(ix in params){
             //rhs_type = new JSHC.FunType([ctx.lookup(params[ix]),rhs_type]);
	     //ctx.rem(params[ix]);
	     //ctx.pop();
	 //}

         //JSHC.alert("constraining: "+ctx.lookupType(comp,ident)+" to "+rhs_type+" for "+ast.ident+" in\n"+ctx.toString());
         ctx.constrainValue(ast.ident, ctx.lookupTypeUnmodified(comp,ast.ident), rhs_type);
	 break;

  // skip fixity and type signature declarations
  // TODO: should have been removed by the name checker.
  case "fixity":
      break;
  case "type-signature":
      break;

  case "topdecl-data": // .constrs

	 ctx.push();
	 var tycon = ast.typ.tycon;
	 
	 // since all types are declared at top-level, all references to them
	 // are qualified, so no purpose of adding the tycon to the local
	 // context since it will never be used.
	 // the type must instead of placed on the name in the tspace.
	 //var tycon_tv = ctx.add(tycon);
	 tycon.kind = ctx.newBoundTyVar();
	 
         var params = ast.typ.vars;
	 for(var ix=0 ; ix<params.length ; ix++){
	     var param = params[ix];
	     ctx.push();
	     ctx.add(param);   // automatically get a new kivar
         }
         
         for(var ix=0 ; ix<ast.constrs.length ; ix++){
             var constr = ast.constrs[ix];
             for(var ty_ix=0 ; ty_ix<constr.types.length ; ty_ix++){
                 var ty = constr.types[ty_ix];
                 var kind = JSHC.Check.checkType(comp,ctx,ty);
                 ctx.constrainValue(ty, kind, JSHC.Check.StarKind);
             }
         }

         rhs_kind = JSHC.Check.StarKind;
	 for(var ix=params.length-1 ; ix>=0 ; ix--){
	     var param = params[ix];
             rhs_kind = new JSHC.FunType([ctx.lookupKind(comp,param),rhs_kind]);
	     ctx.rem(param);
	     ctx.pop();
	 }

         ctx.constrainValue(tycon, tycon.kind, rhs_kind);

         // replace all remaining type variables with "*".
         tycon.kind = ctx.simplify(tycon.kind);
         tycon.kind = ctx.quantifyKind(tycon.kind);

         // create tycon type (tycon applied to the type vars).
         // this is the result type of the dacons.
         tycon_type = tycon;
	 for(var ix=0 ; ix<params.length ; ix++){
	     var param = params[ix];
	     tycon_type = new JSHC.AppType(tycon_type,param);
         }

         // create types for dacons.
         for(var ix=0 ; ix<ast.constrs.length ; ix++){
             var constr = ast.constrs[ix];
             var dacon_type;
             if( constr.types.length > 0 ){
                 dacon_type = [].concat(constr.types);
                 dacon_type.push(tycon_type);
                 dacon_type = new JSHC.FunType(dacon_type);
             } else {
                 dacon_type = tycon_type;
             }
             constr.dacon.type = ctx.quantifyType(dacon_type);
             //JSHC.alert("after dacon qualification:\n",constr.dacon.type.toString(),"\n\n",ctx.toString());
             
             // debug: see if types and kinds are added
             //JSHC.alert("datatype: ",tycon.id," : ",tycon.kind.toString(),"\ndacon: ",constr.dacon.id," : ",constr.dacon.type.toString());
         }

	 ctx.pop();
	 break;

     // add all ast.typ.vars to the context.
     // check each ast.constrs while resolving constraints.
     // replace all free variables with "*", then eliminate the ast.typ.vars,
     // then check if the type/kind is correct for each remaining variable that
     // is referred to. all other variables (that are not referred to) is the
     // type constructor and the type variables for it.
     // Q:do this after checking all decls in a whole group ?
     
     // give each of the data constructors the type that they have in the type
     // declaration.

  default:
      throw new JSHC.CompilerError("topdecl: missing case: "+ast.name);
  };
};

/*
    infers the kind of a type
*/
JSHC.Check.checkType = function(comp,ctx,ast){
    assert.ok( ctx !== undefined );
    assert.ok( ast !== undefined );

    switch( ast.name ){

    case "tycon": case "tyvar":
        // lookup kind of tycon/kivar and return it
        return ctx.lookupKind(comp,ast);

    case "funtype":
        //var ret_type = ast.types[ast.types.length-1];
        //for(var ix=ast.types.length-2 ; ix>0 ; ix--){
            //var ret_type = new JSHC.FunType([ast.types[ix],ret_type]);
        //}
        //return ret_type;
        for(var ix=0 ; ix<ast.types.length ; ix++ ){
            var ty_kind = JSHC.Check.checkType(comp,ctx,ast.types[ix]);
            ctx.constrainValue(ast.types[ix], ty_kind, JSHC.Check.StarKind);
        }
        return JSHC.Check.StarKind;

    case "apptype":
        var lhs_kind = JSHC.Check.checkType(comp,ctx,ast.lhs);
        var rhs_kind = JSHC.Check.checkType(comp,ctx,ast.rhs);
        var ret_type = ctx.newUnboundTyVar();

        var fun_type = new JSHC.FunType([rhs_kind, ret_type]);
        ctx.constrainValue(ast.lhs, lhs_kind, fun_type);
        return ret_type;

    case "forall":
        // add all bound type variables
        for(var binding in ast.binds){
            ctx.add(ast.binds[binding]);
        }

        // check the type
        JSHC.Check.checkType(comp,ctx,ast.type);

        return JSHC.Check.StarKind;

    default:
	throw new Error("missing case for "+ast.name);
    }
};

JSHC.Check.checkExp = function(comp,ctx,ast){
    assert.ok( ctx !== undefined );
    assert.ok( ast !== undefined );

    try {

    switch( ast.name ){

    case "infixexp": // should not be here. assume single entry.
	assert.ok( ast.exps.length === 1 );
	return JSHC.Check.checkExp(comp,ctx,ast.exps[0]);
	break;

    case "let":
    case "fun-where": // .decls .exp
	// check ast.decls (create dep groups of list of "decl-fun")
	// add a map to the context and insert all declared names.
	// call JSHC.Check.checkDecls for each group to get the types.
	JSHC.Check.typeCheckTopDeclsInDepOrder(comp,ctx,ast.decls);

	ctx.push();
	// add names (with their types) from decls
	for(var ix=0 ; ix<ast.decls.length ; ix++){
	    var decl = ast.decls[ix];
	    if( decl.name !== "decl-fun" ||
	        ctx.isNameInCurrentContext(decl.ident) ){
	        continue;
	    }
	    ctx.add(decl.ident,decl.ident.type);
	}

	// check the expression (in scope of the declarations)
	var ty = JSHC.Check.checkExp(comp,ctx,ast.exp);
	
	// remove context with all names from the where-declaration.
	for(var ix=0 ; ix<ast.decls.length ; ix++){
	    var decl = ast.decls[ix];
	    if( decl.name !== "decl-fun" ||
	        ctx.isNameInCurrentContext(decl.ident) ){
	        continue;
	    }
	    ctx.rem(decl.ident);
	}
	ctx.pop();
	return ty;
	break;

    case "ite": // .e1 .e2 .e3
	// infer types from e1, e2, and e3 to get t1, t2, t3.
	var t1 = JSHC.Check.checkExp(comp,ctx,ast.e1);
	var t2 = JSHC.Check.checkExp(comp,ctx,ast.e2);
	var t3 = JSHC.Check.checkExp(comp,ctx,ast.e3);
	
	// enforce "t1 = Prelude.Bool" and "t2 = t3". return t2.
	ctx.constrainValue(ast.e1, t1,new JSHC.TyCon("Prelude.Bool"));
	ctx.constrainValue(ast.e2, t2, t3);
	return ctx.simplify(t2);

    case "application": // .exps ([qvar/gcon/literal/exp/tuple])
        if( ast.exps.length == 1 ){
            return JSHC.Check.checkExp(comp,ctx,ast.exps[0]);
	} else {
	    var exp_types = [];
	    for(var ix=0 ; ix<ast.exps.length ; ix++ ){
	        exp_types.push(JSHC.Check.checkExp(comp,ctx,ast.exps[ix]));
	        //JSHC.alert("got ",exp_types[exp_types.length-1]," from ",ast.exps[ix]);
	    }
            //JSHC.alert(exp_types);
            //JSHC.alert(ctx.toString());

	    var fun_type = exp_types[0];
	    exp_types.shift();
	    var ret_type = ctx.newUnboundTyVar();
	    exp_types.push(ret_type);
            var inferred_type = new JSHC.FunType(exp_types);
            //JSHC.alert("constraining ",fun_type.toString()," to ",inferred_type.toString());
            ctx.constrainValue(ast.exps[0],fun_type,inferred_type);
	    return ret_type;
        }
	//if( ! (fun_type instanceof JSHC.FunType) ){
	//    throw new Error("non-function can not be applied to arguments");
	//}
	//ctx.constrainValue(...,fun_type,new JSHC.FunType([arg_type,ret_type]));
/*
	// when NOT applying too many arguments
        if( fun_type.types.length >= ast.exps.length ){
            // produce a constraint for each param+argument pair
	    for(var arg=1 ; arg<ast.exps.length ; arg++ ){

            // return the remaining number of params + return type
        } else {
            // for each of the fun_type.types.length-1 params that
            // are known, produce a constraint for each param+argument pair.
            // return the return type of the function type, which must be
            // constrained to the be same as the remaining
            // argument types + a new tyvar.
        }
*/
	break;

    case "lambda": // .args (apat: [var/gcon/literal/tuple_pat]) .rhs (rec)
        return JSHC.Check.checkExpPattern(comp, ctx, ast.args, ast.rhs);

    case "case": // .exp (rec) .alts ([{pat: apat/({name: "conpat", con: gcon, pats: apats})], exp: exp}])
        // infer type of ast.exp.
        // for each "pat,exp" branch, check it.
        // must constrain the LHS type to type of ast.exp.
        // must constrain the RHS type to return type.

	var exp_type = JSHC.Check.checkExp(comp,ctx,ast.exp);
	
	var ret_type = ctx.newUnboundTyVar();

        for(var ix=0 ; ix<ast.alts.length ; ix++){
            var alt = ast.alts[ix];
	    var pat_type = JSHC.Check.checkPatternEnter(comp,ctx,alt.pat);
	    ctx.constrainValue(alt.pat,pat_type,exp_type);

	    var rhs_type = JSHC.Check.checkExp(comp,ctx,alt.exp);
	    ctx.constrainValue(alt.exp,rhs_type,ret_type);

            JSHC.Check.checkPatternExit(comp,ctx,alt.pat);
        }	
	return ret_type;
    
    case "integer-lit":
        // should be "forall a. Num a => a"
        return new JSHC.TyCon("Int32",{},"Data.Int");

    case "dacon": case "varname":
        return ctx.lookupTypeAndInstantiate(comp,ast);
    
    case "tuple":
        // the tuple constructor is chosen based on the expressions in the
        // tuple construction expression.
        var tycon_type = new JSHC.TupleTyCon(ast.members.length);

        var arg_types = [];
        for(var ix=0 ; ix<ast.members.length ; ix++){
            arg_types.push(JSHC.Check.checkExp(comp,ctx,ast.members[ix]));
        }

        var ret_type = tycon_type;
        for(var ix=0 ; ix<arg_types.length ; ix++){
            ret_type = new JSHC.AppType(ret_type,arg_types[ix]);
        }
	return ret_type;

    case "listexp":
        // the tuple constructor is chosen based on the expressions in the
        // tuple construction expression.
        var tycon_type = new JSHC.TupleTyCon(ast.members.length);

        var arg_types = [];
        for(var ix=0 ; ix<ast.members.length ; ix++){
            arg_types.push(JSHC.Check.checkExp(comp,ctx,ast.members[ix]));
        }

        for(var ix=1 ; ix<arg_types.length ; ix++){
            ctx.constrain(arg_types[0],arg_types[ix]);
        }
        return new JSHC.AppType(new JSHC.TyCon("[]",{}),arg_types[0]);

    default:
	throw new Error("missing case for "+ast.name);
  };

        } catch( err ){
            if( err instanceof JSHC.TypeConstraintError ){
                if( err.pos === undefined ){
                   err.pos = ast.pos;
                }
            }
            throw err;
        }
};

/*
*/
JSHC.Check.checkPatternEnter = function(comp,ctx,ast){
    switch( ast.name ){
    case "varname":
        ctx.push();
        return ctx.add(ast);   // automatically get a new tyvar

    case "wildcard":
    case "integer-lit":
    case "dacon":
        return ctx.lookupTypeAndInstantiate(comp,ast);

    case "conpat":
        // check constructor. check patterns.
        // build up a function type of the pattern types and then constrain it
        // to the dacon type.
        var con_type = JSHC.Check.checkPatternEnter(comp,ctx,ast.con);
        var arg_types = [];
        for(var ix=0 ; ix<ast.pats.length ; ix++){
            arg_types.push(JSHC.Check.checkPatternEnter(comp,ctx,ast.pats[ix]));
        }

	var ret_type = ctx.newUnboundTyVar();
	arg_types.push(ret_type);
        var inferred_type = new JSHC.FunType(arg_types);
        //JSHC.alert("constraining ",fun_type.toString()," to ",inferred_type.toString());
        ctx.constrainValue(ast.con,con_type,inferred_type);
	return ret_type;

    case "tuple_pat":
        return JSHC.Check.checkPatternEnter(comp,ctx,{name: "conpat", con: new JSHC.TupleDaCon(ast.members.length, ast.pos), pats: ast.members});

    default:
        throw new Error("missing case for " + ast.name);
   }
};

JSHC.Check.checkPatternExit = function(comp,ctx,ast){
	     switch( ast.name ){
	     case "varname":
	         ctx.rem(ast);
	         ctx.pop();
	         break;

	     case "wildcard":
	     case "dacon":
	     case "integer-lit":
	         break;

	     case "tuple_pat":
	         for(var ix=ast.members.length-1 ; ix>=0 ; ix--){
	             JSHC.Check.checkPatternExit(comp,ctx,ast.members[ix]);
	         }
	         break;

	     case "conpat":
	         JSHC.Check.checkPatternExit(comp,ctx,ast.con);
	         for(var ix=ast.pats.length-1 ; ix>=0 ; ix--){
	             JSHC.Check.checkPatternExit(comp,ctx,ast.pats[ix]);
	         }
	         break;

	     default:
	         throw new Error("missing case for " + ast.name);
	     }
};
/*
  checks an expression given some arguments.
*/
JSHC.Check.checkExpPattern = function(comp,ctx,args,rhs){
         var pat_types = [];
	 for(var ix=0 ; ix<args.length ; ix++){
	     pat_types.push(JSHC.Check.checkPatternEnter(comp,ctx,args[ix]));
	 }

	 // check RHS:
	 var rhs_type = JSHC.Check.checkExp(comp,ctx,rhs);
	 assert.ok( rhs_type !== undefined, "undefined RHS when checking "+JSHC.showAST(rhs) );

	 // removes the names that are no longer needed and will not be
	 // quantified. this should free all remaining type variables in the
	 // current tyvar context.
	 for(var ix=args.length-1 ; ix>=0 ; ix--){
	     var param = args[ix];
	     var arg_type = ctx.simplify(pat_types[ix]);
             rhs_type = new JSHC.FunType([arg_type,rhs_type]);
             
             JSHC.Check.checkPatternExit(comp,ctx,args[ix]);
	 }

	return rhs_type;
};

////////////////////////////////////////////////////////////////////////////////

// note: can only eliminate type variables that are out-of-scope.
// global variables that become out-of-scope will have their type stored in the
// name object, while local variables will just disappear as they are now
// unreachable.

// unifies the equations and returns a substitution.
JSHC.Check.unifyS = function(equations,ctx){
  // ...
  return ctx;
};

////////////////////////////////////////////////////////////////////////////////

// list of maps from names to types that represents the local contexts.
JSHC.Check.Ctx = function(){
    this.freevars = new JSHC.Check.Freevars();

    this.contexts = [];  // sets of name
    this.tyvars = []; // sets of existing tyvars
    //this.unresolved = {}; // mapping from name to type
    this.tyvar_ctx = {}; // the constraints. mapping from tyvar to type.
};
/*
  checks if tyvar is bound by any outer or current declaration.
*/
JSHC.Check.Ctx.prototype.isUnboundTyVar = function(tyvar1){
  // return true if and only if it is a type variable that is not in any
  // context above the current one (i.e at this.tyvars.length-1), so exclude
  // the last one.
  for(var ix=0 ; ix<this.tyvars.length-1 ; ix++){
    var tyvar_ctx = this.tyvars[ix];
    for(var tyvar2 in tyvar_ctx){
      if( tyvar1.id === tyvar2.id ){
        return false;
      }
    }
  }
  return true;
};
JSHC.Check.Ctx.prototype.toString = function(){
    var m = [];
    var wrote;

    m.push("declared names:\n");
    wrote = false;
    for(var c=0 ; c<this.contexts.length ; c++){
        m.push("in name context "+c+":\n");
	for(var qname in this.contexts[c]){
	    wrote = true;
	    m.push(qname);
	    m.push(" : ");
	    m.push(this.contexts[c][qname].toString());
	    m.push("\n");
	}
    }
    if( wrote )m.pop();

    m.push("\n\ntype variables:\n");
    wrote = false;
    for(var c=0 ; c<this.tyvars.length ; c++){
        m.push("in type variable context "+c+":\n");
	for(var n in this.tyvars[c]){
	    wrote = true;
	    m.push(n);
	    m.push(",");
	}
    }
    if( wrote )m.pop();

    m.push("\n\nconstraints:\n");
    wrote = false;
    for(var v in this.tyvar_ctx){
	wrote = true;
	m.push(v);
	m.push(" = ");
	m.push(this.tyvar_ctx[v].toString());
	m.push("\n");
    }
    if( wrote )m.pop();
    return m.join("");
};

/*
  replace all kivars with "*"
*/
JSHC.Check.Ctx.prototype.quantifyKind = function(type){
    return JSHC.Check.kindify(type);
};

JSHC.Check.Ctx.prototype.quantifyType = function(type){
    // compute the set of USED type variables in the type
    var used = JSHC.Check.computeUsedVars(type);

    // compute the intersection of the USED type variables and the
    // current set of type variables to get the smallest possible
    // set that quantifies all that may be quantified.
    var empty = true;
    for(var k in used){
	if( this.isUnboundTyVar(k) ){
	    empty = false;
	} else {
	    delete used[k];
	}
    }

    var keyAmount = JSHC.numberOfKeys(used);
    var binds = JSHC.Check.generateTyVarSequence(keyAmount);
    var ix=0;
    for(var u in used){
        used[u] = binds[ix];
        ix++;
    }

    if( ! empty ){
        type = JSHC.Check.replaceTyVars(used, type);
        type = new JSHC.ForallType(binds, type);
    }
    return type;
};

JSHC.Check.Ctx.prototype.quantify = function(name){

    // replace all occurences of tyvars in the type that are in
    // the current (innermost) context with new type variables 't0', 't1', etc..
    // and quantify them.

    //var curr_tvs = this.tyvars[this.tyvars.length-1];
    var curr_ctx = this.contexts[this.contexts.length-1];
    curr_ctx[name.toStringQ()] = this.quantifyType(curr_ctx[name.toStringQ()]);
    return curr_ctx[name.toStringQ()];
};


//JSHC.Check.Ctx.prototype.clearTyVars = function(){
    //this.freevars = new Freevars();
//    this.tyvars = {};
//    this.constraints = {};
//};
/*
JSHC.Check.Ctx.prototype.freeTyVar = function(tyvar){
    if( this.tyvars[tyvar] === undefined ){
	throw new Error("unable to free type variable "+tyvar+" as it is not bound.");
    }
    delete this.tyvars[tyvar];

    // remove from contraints if possible.
    var rhs = this.constraints[tyvar];
    if( rhs === undefined )return;

    // find all occurences of the tyvar in the RHSs and replace with 'rhs'.
    for(var c in this.constraints){
        this.constraints[c] = JSHC.Check.replaceTyvarWith(tyvar,rhs,this.constraints[c]);
    }
};
*/
JSHC.Check.Ctx.prototype.newBoundTyVar = function(){
    var tyvar = this.freevars.next();
    this.tyvars[this.tyvars.length-1][tyvar] = tyvar;
    return tyvar;
};
JSHC.Check.Ctx.prototype.newUnboundTyVar = function(){
    var tyvar = this.freevars.next();
    return tyvar;
};

/*
  takes a value and two types and adds appropriate constraints or throws a
  type error for the value.
*/
JSHC.Check.Ctx.prototype.constrainValue = function(value,type1,type2){
    try {
        this.constrain(type1,type2);
    } catch(err){
        if( err instanceof JSHC.TypeConstraintError ){
            // add value in which the error occured
            err.value = value;
        }
        throw err;
    }
}

/*
  takes two types and adds appropriate constraints or throws a type error
*/
JSHC.Check.Ctx.prototype.constrain = function(type1,type2){
    assert.ok( type1 !== undefined );
    assert.ok( type2 !== undefined );
    // can get two arbitrary types. simplify as needed.

    //if( !(type2.toStringQ instanceof Function) )
    //    JSHC.alert(type1,type2);

    if( type1 instanceof JSHC.TyVar ){
	if( type2 instanceof JSHC.TyVar && type1.id == type2.id ){
	    return; // nothing to add as constraint does nothing
	} else {
	    // type1 is a tyvar while type2 might be
	    this.insertConstraint(type1, type2);
	}
    } else if( type2 instanceof JSHC.TyVar ){
        this.insertConstraint(type2, type1);
    } else if( type1 instanceof JSHC.AppType && type2 instanceof JSHC.AppType ){
        this.constrain(type1.lhs,type2.lhs);
        this.constrain(type1.rhs,type2.rhs);
    } else if( type1 instanceof JSHC.FunType && type2 instanceof JSHC.FunType ) {
        var t2 = type2.types;
        var t1 = type1.types;
        // put the shortest in 't1'
        if( t2.length < t1.length ){
            var tmp = t2;
            t2 = t1;
            t1 = tmp;
        }
        // make constraints for all types except the last
        for(var ix=0; ix<t1.length-1 ; ix++ ){
            this.constrain(t1[ix], t2[ix]);
        }
        // if same length, then just another constraint
        if( t1.length === t2.length ){
            this.constrain(t1[t1.length-1], t2[t2.length-1]);
        } else {
            var funtype = new JSHC.FunType(t2.slice(t1.length-1));
            this.constrain(t1[t1.length-1],funtype);
        }
    } else if( type1 == JSHC.Check.StarKind && type2 == JSHC.Check.StarKind ) {
        return;
    } else if( type1.toStringQ() == type2.toStringQ() ) {
        return;
    } else {
	throw new JSHC.TypeConstraintError(type1, type2);
    }
};
/*
  takes a tyvar and a type that it is equivalent to.
*/
JSHC.Check.Ctx.prototype.insertConstraint = function(tyvar,type1){
   assert.ok( tyvar instanceof JSHC.TyVar );

   if( this.tyvar_ctx[tyvar] !== undefined ){
      // there is a mapping to some "type2"
      // add constraint "type1 = type2"
      this.constrain(type1,this.tyvar_ctx[tyvar]);
   } else {
      // if tyvar does NOT exist in the mapping

      //JSHC.alert("tyvar: ",tyvar,"\ntype: ",type1.toString());

      // simplify type1 using existing constraints.

      //if( type1.name=="forall" ){
      //    JSHC.alert("simplifying: ",type1.toString());
      //}
      type1 = this.simplify(type1);

      // check for occurences of "tyvar" in "type1". if so, fail.
      if( JSHC.Check.isVarInType(tyvar,type1) ){
          throw new JSHC.TypeConstraintError(tyvar,type1,"infinite type");
      }

      // insert into constraint mapping
      this.tyvar_ctx[tyvar] = type1;
      
      // eliminate all occurences of "tyvar" in RHSs.
      this.eliminateTyVar(tyvar);
   }
};
/*
   simplify a type using existing constraints.
*/
JSHC.Check.Ctx.prototype.simplify = function(type){
    assert.ok ( type !== undefined );

    switch( type.name ){
    case "tyvar":
        if( this.tyvar_ctx[type] !== undefined ){
            return this.tyvar_ctx[type];
        } else {
            return type;
        }

    case "tycon":
        return type;

    case "starkind":
        return type;

    case "apptype":
        var lhs = this.simplify(type.lhs);
        var rhs = this.simplify(type.rhs);
        return new JSHC.AppType(lhs,rhs);

    case "funtype":
        var ts = [];
        for(var t=0 ; t<type.types.length ; t++){
           ts.push(this.simplify(type.types[t]));
        }
        return new JSHC.FunType(ts);

    case "forall":
        assert.ok( false );

    default:
        throw new Error("unknown type: "+type.name);
    };
};
JSHC.Check.Ctx.prototype.eliminateTyVar = function(tyvar1){
  // look up the RHS of the given tyvar
  var type1 = this.tyvar_ctx[tyvar1];
  var type1_vars = JSHC.Check.computeUsedVars(type1);

  // replace all occurences of the tyvar in the RHSs of the contexts
  for(var ix=0 ; ix<this.contexts.length ; ix++ ){
    var context = this.contexts[ix];
    for(var qname in context){
      var type2 = context[qname];

      // replace all occurences of 'tyvar1' in 'type2' with 'type1'
      type2 = JSHC.Check.replaceTyVarWith(tyvar1,type1,type2);

      // replace old type with the new type
      context[qname] = type2;
    }
  }

  // replace all occurences of the tyvar in the RHSs.
  for(var tyvar2 in this.tyvar_ctx){
    var type2 = this.tyvar_ctx[tyvar2];

    // replace all occurences of 'tyvar1' in 'type2' with 'type1'
    type2 = JSHC.Check.replaceTyVarWith(tyvar1,type1,type2);

    // replace old type with the new type
    this.tyvar_ctx[tyvar2] = type2;

    if( type1_vars[tyvar2] && JSHC.Check.isVarInType(tyvar2,type2) ){
      throw new JSHC.TypeConstraintError(tyvar2,type2,"infinite type");
    }
  };
};

JSHC.Check.Ctx.prototype.isNameInCurrentContext = function(name){
    return this.contexts[this.contexts.length-1][name.toStringQ()] !== undefined;
};

// can take specified types (signatures) for params
JSHC.Check.Ctx.prototype.add = function(name,type){
    if( type === undefined ){
	type = this.newBoundTyVar();
    }
    //name.type = type;
    assert.ok( this.contexts[this.contexts.length-1][name.toStringQ()] == undefined, "trying to add "+name.toStringQ()+" twice in a context" );
    this.contexts[this.contexts.length-1][name.toStringQ()] = type;
    return type;
};
JSHC.Check.Ctx.prototype.rem = function(name){
    var ctx = this.contexts[this.contexts.length-1];
    assert.ok( ctx[name.toStringQ()] !== undefined, "name must exist. trying to delete "+name );
    delete ctx[name.toStringQ()];
};
/*
  lookup type and instantiate quantified type variables
*/
JSHC.Check.Ctx.prototype.lookupTypeUnmodified = function(comp,name){
   return this.lookupAny(comp,name,"type");
};

JSHC.Check.Ctx.prototype.lookupTypeAndInstantiate = function(comp,name){
   var type = this.lookupAny(comp,name,"type");
   return this.instantiate(type);
};

JSHC.Check.Ctx.prototype.lookupKind = function(comp,name){
   return this.lookupAny(comp,name,"kind");
};

JSHC.Check.Ctx.prototype.lookupAny = function(comp,name,field){
    var ix;
    /*
    var n = this.unresolved[name];
    if( n !== undefined ){
	assert.ok( n !== undefined );
	return n;
    }
    */
    
    // TODO: if name check failed for the name (warning), then the name must
    //       have been marked with a ".bad" member or something so that one can
    //       throw an exception here and skip everything that it depends upon.

    //JSHC.alert("looking up: ",name);

    var int32_type = new JSHC.TyCon("Int32",{},"Data.Int");
    var bool_type = new JSHC.TyCon("Bool",{},"Prelude");

    if( name.name == "integer-lit" ){
        return int32_type;
    } else if( name.name == "wildcard" ){
        var tyvar = new JSHC.TyVar("a");
        return new JSHC.ForallType([tyvar],tyvar);
    } else if( name.name == "dacon" && name.id == "()" ){
        // () :: ()
        return new TyCon("()",{});
    } else if( name.name == "dacon" && name.id == "[]" ){
        // []     :: ∀a. [] a
        var tyvar = new JSHC.TyVar("a");
        var list_tycon = new JSHC.TyCon("[]",{});
        var inner_type = new JSHC.AppType(list_tycon,tyvar);
        return new JSHC.ForallType([tyvar],inner_type);
    } else if( name.name == "dacon" && name.id == ":" && name.isSymbol === true){
        // (:)    :: ∀a. a -> [] a -> [] a
        var tyvar = new JSHC.TyVar("a");
        var list_tycon = new JSHC.TyCon("[]",{});
        var list_a_type = new JSHC.AppType(list_tycon,tyvar);
        var fun_type = new JSHC.FunType([tyvar,list_a_type,list_a_type]);
        return new JSHC.ForallType([tyvar],fun_type);
    } else if( name.name == "dacon" && name instanceof JSHC.TupleDaCon ){
        return (function(){
            var tycon_type = new JSHC.TupleTyCon(name.numberOfParams,name.pos);
            var params = JSHC.Check.generateTyVarSequence(name.numberOfParams);

            var ret_type = tycon_type;
            for(var ix=0 ; ix<params.length ; ix++){
                ret_type = new JSHC.AppType(ret_type,params[ix]);
            }

            var fun_params = [].concat(params);
            fun_params.push(ret_type);
            var fun_type = new JSHC.FunType(fun_params);

            var type = new JSHC.ForallType(params,fun_type);

            return type;
        }());
    } else {

        // look up name in lspace
        for(ix=this.contexts.length-1 ; ix>=0 ; ix--){
	    n = this.contexts[ix][name.toStringQ()];
            if( n !== undefined ){
	        assert.ok( n !== undefined );
	        return n;
            }
        }

        if( name.loc !== undefined ){
            if( name.loc == "JSHC.Internal" ){
                // TODO: should use foreign declarations instead to specify the type.
                var iii_type = new JSHC.FunType([int32_type,int32_type,int32_type]);
                var ii_type = new JSHC.FunType([int32_type,int32_type]);
                var iib_type = new JSHC.FunType([int32_type,int32_type,bool_type]);
                if( field == "type" ){
                    switch( name.id ){
                    case "int32add":
                    case "int32sub":
                    case "int32mul":
                    case "int32div":
                    case "int32max":
                    case "int32min":
                        return iii_type;

                    case "int32negate":
                    case "int32abs":
                    case "int32signum":
                        return ii_type;

                    case "int32lt":
                    case "int32gt":
                    case "int32le":
                    case "int32ge":
                    case "int32eq":
                    case "int32ne":
                        return iib_type;

                    case "undefined":
                        var tyvar_a = new JSHC.TyVar("a");
                        return new JSHC.ForallType([tyvar_a],tyvar_a);

                    case "strLit":
                        var char_ty = new JSHC.TyCon("Char", "Prelude");
                        var list_ty = new JSHC.TyCon("[]", "Prelude");
                        return new JSHC.FunType([int32_type, new JSHC.AppType(list_ty, char_ty)]);
                    case "show":
                        var tv_s = new JSHC.TyVar("a");
                        var char_ty2 = new JSHC.TyCon("Char", "Prelude");
                        var list_ty2 = new JSHC.TyCon("[]", "Prelude");
                        return new JSHC.ForallType([tv_s], new JSHC.FunType([tv_s, new JSHC.AppType(list_ty2, char_ty2)]));
                    case "putStr":
                    case "putStrLn":
                        var tv_p = new JSHC.TyVar("a");
                        var unit_ty = new JSHC.TyCon("()", "Prelude");
                        return new JSHC.ForallType([tv_p], new JSHC.FunType([tv_p, unit_ty]));
                    case "seq":
                        var tyvar_a = new JSHC.TyVar("a");
                        var tyvar_b = new JSHC.TyVar("b");
                        var fun_type = new JSHC.FunType([tyvar_a,tyvar_b,tyvar_b]);
                        return new JSHC.ForallType([tyvar_a,tyvar_b],fun_type);
                    default:
                        throw new JSHC.CompilerError("missing type for built-in function; "+name.toStringQ());
                    }
                }
            }

            //if( name.loc !== "Prelude" ){
            //    JSHC.alert("looking up (qualified): ",name);
            //    for( var xxcm in comp.modules ){
            //        JSHC.alert(xxcm);
            //    }
            //    JSHC.alert(comp.modules[name.loc].ast.espace);
            //}
        
            var espace = comp.modules[name.loc].ast.espace;
            var expo = espace[name];
            //if( name.loc !== "Prelude" )JSHC.alert("found ",expo);
            var info = espace[name][field];
            if( info === undefined ){
                comp.onError("type information missing for "+name.toStringQ());
            } else {
                return info;
            }
            //JSHC.alert("accessing " + name + " in espace ", comp.modules[name.loc].ast.espace);
            // return JSHC.Check.instantiate(modules[name.loc].espace[name][field]);
        }
    }

    // only possible if error in name check or if continuing after name check
    // anyway.
    throw new JSHC.SourceError(undefined,undefined,"type error: "+JSHC.showAST(name));
};
JSHC.Check.Ctx.prototype.push = function(){
    //this.contexts.push(opt_list===undefined ? {} : opt_list);
    this.contexts.push({});
    this.tyvars.push({});
};
JSHC.Check.Ctx.prototype.pop = function(){
    var curr_tv = this.tyvars[this.tyvars.length-1];
    var curr_ctx = this.contexts[this.contexts.length-1];

    var remaining = [];
    for(var qname in curr_ctx ){
	var used_vars = JSHC.Check.computeUsedVars(curr_ctx[qname]);
	for(var v in used_vars){
	    if( curr_tv[v] ){
		remaining.push(v);
	    }
	}
    }

    assert.ok( remaining.length === 0, "remaining type variables: "+remaining );

    this.contexts.pop();
    this.tyvars.pop();
};

////////////////////////////////////////////////////////////////////////////////

/*
  generator for new unique type variables
*/
JSHC.Check.Freevars = function(){
    this.amount = 0;
};
JSHC.Check.Freevars.prototype.next = function(){
    return new JSHC.TyVar("'t"+(++this.amount));
};

////////////////////////////////////////////////////////////////////////////////

/*
  find all occurences of 'tyvar' in 'type' and replace them with 'rtype',
  and then return the new type.
*/
JSHC.Check.replaceTyVarWith = function(tyvar,rtype,type){
    assert.ok ( type !== undefined );

    var replace = function(type){
	switch( type.name ){
	case "tyvar":
	    if( type == tyvar ){
	        return rtype;
	    } else {
	        return type;
	    }

	case "forall":
	    assert.ok( false );
	    return type;

        case "apptype":
            var lhs = replace(type.lhs);
            var rhs = replace(type.rhs);
            return new JSHC.AppType(lhs,rhs);

        case "funtype":
            var ts = [];
            for(var t=0 ; t<type.types.length ; t++){
               ts.push(replace(type.types[t]));
            }
            return new JSHC.FunType(ts);

	case "tycon":
	    return type;

        case "starkind":
            return type;

	default:
	    throw new Error("unknown type: "+type.name);
	};
    };

    return replace(type);
};

/*
  find all occurences of 'tyvar' in 'type' and replace them with 'rtype',
  and then return the new type.
*/
JSHC.Check.replaceTyVars = function(mapping,type){
    assert.ok ( type !== undefined );

    var replace = function(type){
	switch( type.name ){
	case "tyvar":
	    if( mapping[type] !== undefined ){
	        return mapping[type];
	    } else {
	        return type;
	    }

	case "forall":
	    assert.ok( false );
	    return type;

        case "apptype":
            var lhs = replace(type.lhs);
            var rhs = replace(type.rhs);
            return new JSHC.AppType(lhs,rhs);

        case "funtype":
            var ts = [];
            for(var t=0 ; t<type.types.length ; t++){
               ts.push(replace(type.types[t]));
            }
            return new JSHC.FunType(ts);

	case "tycon":
	    return type;

        case "starkind":
            return type;

	default:
	    throw new Error("unknown type: "+type.name);
	};
    };

    return replace(type);
};

/*
  returns true if and only if the tyvar occurs in the type
*/
JSHC.Check.isVarInType = function(tyvar,type){
  // simple inefficient implementation
  return JSHC.Check.computeUsedVars(type)[tyvar] !== undefined;
};

/*
   return a set with all tyvars that occur in the type
*/
JSHC.Check.computeUsedVars = function(type){
    assert.ok ( type !== undefined );
    var tvs = {};

    var find = function(type,binds){
	switch( type.name ){
	case "tyvar":
	    if( binds === undefined || binds[type.id] === undefined ){
                tvs[type.id] = type;
	    }
	    break;

	case "forall":
	    assert.ok(binds === undefined);
	    find(type.type,type.binds);
	    break;

	case "funtype":
            for(var t=0 ; t<type.types.length ; t++){
	        find(type.types[t]);
	    }
	    break;

        case "apptype":
	    find(type.lhs);
	    find(type.rhs);
	    break;

        case "starkind":
            break;

	case "tycon":
	    break;

	default:
	    throw new Error("unknown type: "+type.name);
	};
    };

    find(type);
    return tvs;
};

/*
  replace all kind variables with "*"
*/
JSHC.Check.kindify = function(type){
    assert.ok ( type !== undefined );

    var replace = function(type){
	switch( type.name ){
	case "tyvar":
            return JSHC.Check.StarKind;

	case "forall":
	    assert.ok( false );
	    return type;

        case "funtype":
            var ts = [];
            for(var t=0 ; t<type.types.length ; t++){
               ts.push(replace(type.types[t]));
            }
            return new JSHC.FunType(ts);

	case "tycon":
	    return type;
	
	case "starkind":
	    return type;

	default:
	    throw new Error("unknown type: "+type.name);
	};
    };

    return replace(type);
};

JSHC.Check.StarKind = new JSHC.Name();
JSHC.Check.StarKind.name = "starkind";
JSHC.Check.StarKind.toString = function(){
    return "*";
};
JSHC.Check.StarKind.toStringQ = JSHC.Check.StarKind.toString;

////////////////////////////////////////////////////////////////////////////////

/*
  Return a set with all used qualified names that occur in the expression.
*/
/*
JSHC.Check.computeUsedQualifiedNames = function(ast){

    var names = {};

    var find = function(ast){
	switch( ast.name ){

        case "topdecl-data":
            var constrs = ast.constrs;
            for(var i=0 ; i<constrs.length ; i++){
                var types = constrs[i].types;
                for(var j=0 ; j<types.length ; j++){
                    find(types[j]);
                }
            }
            break;

        case "application":
            var exps = ast.exps;
            for(var i=0 ; i<exps.length ; i++){
                find(exps[i]);
            }
            break;

        case "conpat":
            var pats = ast.pats;
            for(var i = 0; i < pats.length; i++){
                find(pats[i]);
            }
            break;

        case "tuple_pat":
        case "tuple":
            var mems = ast.members;
            for(var i = 0; i < mems.length; i++){
                find(mems[i]);
            }
            break;    

        case "apptype":
            find(ast.lhs);
            find(ast.rhs);
            break;
        
        
        case "fun-where":
            var decls = ast.decls;
            for (var i = 0; i < decls.length; i++) {
                find(decls[i]);
            }
            find(ast.exp);
            break;
        
        case "tyvar":
        case "integer-lit":
        case "fixity":
            // nothing to add.
            break;

        case "topdecl-decl":
            find(ast.decl);
            break;

        case "alt":
            find(ast.pat);
            find(ast.exp);
            break;

        case "case":
            find(ast.exp);
            ast.alts.forEach(function(a){find(a)});
            break;

        case "lambda":
        case "decl-fun":
            ast.args.forEach(function(a){find(a)});
            find(ast.rhs);
            break;

        case "dacon":
        case "tycon":
        case "varname":
            names[ast] = ast;
            break;

	default:
            throw new JSHC.CompilerError("missing case: "+ast.name);
	};
    };

    find(ast);
    return names;
};
*/
////////////////////////////////////////////////////////////////////////////////

JSHC.Check.computeUsedNamesInDecl = function(dnames, ast){
    var unames = {};
    var lspace = new JSHC.LSpace();

    //JSHC.alert("dnames: ",JSHC.showAST(dnames));

    JSHC.Check.computeUsedNamesIn(dnames, lspace, unames, ast);

    //var used_names = [];
    //for(var un in unames){
    //    used_names.push(unames[un].toString());
    //}

    //JSHC.alert(ast, "\n\nuses\n\n", JSHC.showAST(used_names));

    return unames;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.computeUsedNamesInPat = function(dnames, lspace, unames, ast){
    var find = function(ast){
	switch( ast.name ){
        case "conpat":
            var pats = ast.pats;
            for(var i = 0; i < pats.length; i++){
                find(pats[i]);
            }
            break;

        case "tuple_pat":
        case "tuple":
            var mems = ast.members;
            for(var i = 0; i < mems.length; i++){
                find(mems[i]);
            }
            break;    

        case "dacon":
            // if not declared locally and is in dnames, then it is used.
            if( ast.loc !== undefined || lspace.contains(ast) == false ){
                if( dnames[ast] !== undefined ){
                    unames[ast] = ast;
                }
            }
            break;

        case "varname":
            // add variables to lspace
            lspace.add(ast);
            break;

        case "wildcard":
        case "integer-lit":
            break;

	default:
            throw new JSHC.CompilerError("missing case: "+ast.name);
	};
    };

    find(ast);
};

////////////////////////////////////////////////////////////////////////////////

/*
  Return a set with all names used (from the set of given names) that occur in
  the expression.
  all declarations shadow the names in the set.
*/
JSHC.Check.computeUsedNamesIn = function(dnames, lspace, unames, ast){

    var find = function(ast){
	switch( ast.name ){

        case "topdecl-data":
            // no need to add ast.typ.tycon or any dacons to lspace,
            // since they are only declared at top-level.
            lspace.push();
            for(var ix=0 ; ix<ast.typ.vars.length ; ix++){
                lspace.add(ast.typ.vars[ix]);
            }
            var constrs = ast.constrs;
            for(var i=0 ; i<constrs.length ; i++){
                var dacon = constrs[i].dacon;
                for(var j=0 ; j<constrs[i].types.length ; j++){
                    JSHC.Check.computeUsedNamesIn(dnames, lspace, unames, constrs[i].types[j]);
                }
            }
            lspace.pop();
            break;

        case "application":
            var exps = ast.exps;
            for(var i=0 ; i<exps.length ; i++){
                find(exps[i]);
            }
            break;

	case "funtype":
            for(var t=0 ; t<ast.types.length ; t++){
               find(ast.types[t]);
            }
            break;

        case "apptype":
            find(ast.lhs);
            find(ast.rhs);
            break;

        case "ite":
            find(ast.e1);
            find(ast.e2);
            find(ast.e3);
            break;

        case "listexp":
        case "tuple":
            var mems = ast.members;
            for(var i = 0; i < mems.length; i++){
                find(mems[i]);
            }
            break;    
        
        case "let":
        case "fun-where":
            var decls = ast.decls;
            lspace.push();
            var where_names;
            for (var i = 0; i < decls.length; i++) {
                where_names = JSHC.Check.computeDeclaredNames(decls[i])
            }
            for (var wn in where_names) {
                lspace.add(where_names[wn]);
            }
            for (var i = 0; i < decls.length; i++) {
                find(decls[i]);
            }
            find(ast.exp);
            lspace.pop();
            break;
        
        case "tyvar":
        case "integer-lit":
        case "fixity":
            // nothing to add.
            break;

        case "topdecl-decl":
            find(ast.decl);
            break;

        case "case":
            find(ast.exp);
            ast.alts.forEach(function(a){
                lspace.push();
                JSHC.Check.computeUsedNamesInPat(dnames, lspace, unames, a.pat);
                find(ast.exp);
                lspace.pop();
            });
            break;

        case "lambda":
        case "decl-fun":
            lspace.push();
            ast.args.forEach(function(a){
                JSHC.Check.computeUsedNamesInPat(dnames, lspace, unames, a);
            });
            //JSHC.alert("local space after adding params: ",lspace.toString());
            find(ast.rhs);
            lspace.pop();
            break;

        case "dacon":
        case "tycon":
        case "varname":
            if( ast.loc !== undefined || lspace.contains(ast) == false ){
                if( dnames[ast] !== undefined ){
                    unames[ast] = ast;
                }
            }
            break;

        case "type-signature":
            ast.vars.forEach(function(v){
                if( dnames[v] !== undefined ){
                    unames[v] = v;
                }
            });
            break;

	default:
            throw new JSHC.CompilerError("missing case: "+ast.name);
	};
    };

    find(ast);
    return unames;
};

////////////////////////////////////////////////////////////////////////////////

/*
  Return a set with all declared (toplevel) names that occur in the expression.
*/
JSHC.Check.computeDeclaredNames = function(ast){

    var names = {};

    var find = function(ast){
	switch( ast.name ){

        case "topdecl-data":
            names[ast.typ.tycon] = ast.typ.tycon;
            var constrs = ast.constrs;
            for(var i=0 ; i<constrs.length ; i++){
                var dacon = constrs[i].dacon;
                names[dacon] = dacon;
            }
            break;

        case "topdecl-decl":
            find(ast.decl);
            break;

        case "type-signature":
            ast.vars.forEach(function(v){
                names[v] = v;
            });
            break;

        case "decl-fun":
            names[ast.ident] = ast.ident;
            break;
            
        case "fixity":
            //no typechecking needs to be done for fixity declarations
            break;

	default:
            throw new JSHC.CompilerError("missing case: "+ast.name);
	};
    };

    find(ast);
    return names;
};

////////////////////////////////////////////////////////////////////////////////

/*
  Remove the
*/
JSHC.Check.Ctx.prototype.instantiate = function(ast){
    // should not be any quantification within types, only at the top.
    if( ast.name !== "forall" ){
        return ast;
    }

    var ctx = this;
    var boundVars = {};
    for(var b in ast.binds){
        boundVars[b] = ctx.newUnboundTyVar();
    }

    var replace = function(ast){
	switch( ast.name ){
	case "apptype":
	   var lhs = replace(ast.lhs);
	   var rhs = replace(ast.rhs);
	   return new JSHC.AppType(lhs,rhs);

	case "tycon":
	    return ast;

	case "funtype":
            var ts = [];
            for(var t=0 ; t<ast.types.length ; t++){
               ts.push(replace(ast.types[t]));
            }
            return new JSHC.FunType(ts);

        case "tyvar":
            if( boundVars[ast] !== undefined ){
                return boundVars[ast];
            } else {
                return ast;
            }

	default:
            throw new JSHC.CompilerError("missing case: "+ast.name);
	};
    };

    var newtype = replace(ast.type);
    //JSHC.alert("instantiated ",ast.toString()," into ",newtype.toString());
    return newtype;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Check.generateTyVarSequence = function(amount){
    var binds = [];

    if( amount > 26 ){
        for(var ix=0 ; ix<amount ; ix++){
            binds.push(new JSHC.TyVar("t"+ix));
        }
    } else {
        for(var ix=0 ; ix<amount ; ix++){
            binds.push(new JSHC.TyVar(String.fromCharCode(97+ix)));
        }
    }

    return binds;
};

////////////////////////////////////////////////////////////////////////////////



// --- src/Check/Fixity.js ---

////////////////////////////////////////////////////////////////////////////////
// Fixity Resolution
// converts infix lists to infix application using correct precedences.

JSHC.Fixity = {};  // Fixity module

/*
  modifies the module AST by rewriting infix lists into function applications.
*/
JSHC.Fixity.fixityResolution = function(module_ast){
//        JSHC.alert(module_ast)
    JSHC.Fixity.translateInfixLists(module_ast);
};

////////////////////////////////////////////////////////////////////////////////

/*
  looks up fixity information and defaults to infixl 9 if missing.
*/
JSHC.Fixity.fixityLookup = function(name){
        
    var r = name.id.fixity;
    if( r === undefined ){
	r = {fix: "leftfix", prec: 9};
    }
    return r;
};

////////////////////////////////////////////////////////////////////////////////

/*
  takes an infix list and returns an expression using '-' and/or binary
  operators.
  throws exceptions if anything goes wrong, such as precedence errors.
 */
JSHC.Fixity.resolve = function(exps) {
    assert.ok( exps instanceof Array );
    for(var i=0;i<exps.length;i++){
	assert.ok(exps[i]!==undefined);
    }
    
    resolve_parseNeg = function(prec, fix){
	assert.ok( exps.length > 0 );
	var e0 = exps[0];
//	JSHC.alert("checking fixity of an exp:",e0)
//	alert("resolve parseNeg of: " + JSHC.showAST(e0));
	if( e0.name === "-" ){
	    if( prec >= 6 ){
		throw new JSHC.SourceError("unary minus can not occur here as outer expression has greater (>=6) precedence.");
	    }
	    exps.shift();
	    rexp = resolve_parseNeg(6, "leftfix");
	    return {name:"negate",exp:rexp,pos:e0.pos};
	} else if( e0.name === "qop" ) {
	    throw new JSHC.CompilerError("unexpected operator in precedence resolution: expected '-' or lexp, got: " + JSHC.showAST(e0));
	} else {  // some arbitrary expression
//	    alert("resolve parse: \n" + JSHC.showAST(exps) + "\n\n" + JSHC.showAST(e0));
	    exps.shift();
	    return resolve_parse(prec,fix,e0);
	}
    };
    
    resolve_parse = function(prec1, fix1, exp1){
	if( exps.length === 0 ){
	    return exp1;
	}
//	JSHC.alert("resolve_parse args\nprec1:",prec1,"fix1:",fix1,"\nexp1:",exp1);
	var exp2 = exps[0];
	if( exp2.name === "qop" ){
	    var exp2_fixity = JSHC.Fixity.fixityLookup(exp2);
	    prec2 = exp2_fixity.prec;
	    fix2 = exp2_fixity.fix;
//	    JSHC.alert("prec2:",prec2,"fix2:",fix2,"\nexp2:",exp2);
	
	    if( prec1 === prec2 && (fix1 !== fix2 || fix1 === "nonfix") ){
		throw new JSHC.SourceError("same precedence with non-associative operator");
	    } else if( prec1 > prec2 || (prec1 === prec2 && fix1 == "leftfix" ) ){
	        //this commented out for chained operator applications to work,
	        //i.e. 1 + 2 + 3
//		exps.unshift(exp2);
//		JSHC.alert("unshifted:",exp2,exps,"\nand returned:",exp1);
		return exp1;
	    } else {
//	    alert("resolve_parseNeg:\n\n" + "prec2: " + JSHC.showAST(prec2) + "\n\nfix2: " + JSHC.showAST(fix2));
//                JSHC.alert("before shift: ", exps);
	        exps.shift();
//	        JSHC.alert("shifted:",exps,"\nand calling parseNeg on: ", prec2, fix2)		
		var rexp = resolve_parseNeg(prec2, fix2);
		//rexp = {name:"infix-app", lhs:exp1, op:exp2, rhs:rexp, pos:exp2.pos};
		rexp = {name:"application", exps:[exp2.id,exp1,rexp], pos:exp2.pos, orig:"infix"};
//		alert("FIXED INFIXEXP: \n\n" + JSHC.showAST(rexp));
		return resolve_parse(prec1, fix1, rexp);
	    }
	} else {
	    throw new JSHC.CompilerError("expected operator in precedence resolution, found: " + JSHC.showAST(exp2));
	}
    };
    
    return resolve_parseNeg(-1, "nonfix");
};

////////////////////////////////////////////////////////////////////////////////

/*
  given an AST and a member name, check if the sub-tree referred to by the member
  name is an infix list, and if so, replaces it by using the 'resolve' function.
*/
JSHC.Fixity.translateInfixMember = function(ast, member){
    assert.ok( ast !== undefined && ast.name !== undefined, "param 'ast' must be an AST" );
    assert.ok(typeof member === "string", "type of member is not string but: " + typeof member );
    if( ast[member].name === "infixexp" ){
	ast[member] = JSHC.Fixity.resolve(ast[member].exps);
	assert.ok( ast[member] !== undefined );
    }
};

////////////////////////////////////////////////////////////////////////////////

/*
  given an AST, check if it is an infix list, and if so, apply the 'resolve'
  function and return the result.
*/
JSHC.Fixity.translateInfixExp = function(ast){
//        JSHC.alert("translate:", ast)
    if( ast.name === "infixexp" ){
	return JSHC.Fixity.resolve(ast.exps);
    } else {
	return ast;
    }
};

////////////////////////////////////////////////////////////////////////////////

/*
  replaces all infix lists in an AST.
*/
JSHC.Fixity.translateInfixLists = function(ast){
    assert.ok( ast !== undefined && ast.name !== undefined, "param 'ast' must be an AST" );
//    alert("translateInfixLists: " + ast.name);
    var f = JSHC.Fixity.translateInfixLists[ast.name];
    if( f === undefined ){
	throw new Error("no definition for " + JSHC.showAST(ast) ); //+ast.name);
    }
    assert.ok( f instanceof Function, ast.name+" <: Function." )
    f(ast);
};

JSHC.Fixity.translateInfixLists["module"] = function(ast){
    // ignoring exports as there are no expressions to translate there
    JSHC.Fixity.translateInfixLists(ast.body);
};

JSHC.Fixity.translateInfixLists["body"] = function(ast){
    var i;
    
    // ignoring imports as there are no expressions to translate there
    
    for(i=0;i<ast.topdecls.length;i++){
	JSHC.Fixity.translateInfixLists(ast.topdecls[i]);
    }
};

JSHC.Fixity.translateInfixLists["topdecl-decl"] = function(ast){
    JSHC.Fixity.translateInfixLists(ast.decl);
};

JSHC.Fixity.translateInfixLists["topdecl-data"] = function(ast){
    // no expressions to translate here
};

JSHC.Fixity.translateInfixLists["decl-fun"] = function(ast){
    // TODO: currently nothing to do for the LHS.
    //       adding constructor operators will make infix expressions in patterns.
    JSHC.Fixity.translateInfixMember(ast, "rhs");
    JSHC.Fixity.translateInfixLists(ast.rhs);
};

JSHC.Fixity.translateInfixLists["fun-where"] = function (ast) {
    JSHC.Fixity.translateInfixMember(ast, "exp");
    JSHC.Fixity.translateInfixLists(ast.exp);
    
    for (var i = 0; i < ast.decls.length; i++) {
        JSHC.Fixity.translateInfixLists(ast.decls[i]);
    }
};

JSHC.Fixity.translateInfixLists["let"] = function (ast) {
    JSHC.Fixity.translateInfixMember(ast, "exp");
    JSHC.Fixity.translateInfixLists(ast.exp);
    
    for (var i = 0; i < ast.decls.length; i++) {
        JSHC.Fixity.translateInfixLists(ast.decls[i]);
    }
};

JSHC.Fixity.translateInfixLists["constrained-exp"] = function(ast){
    // no infix expressions in type signatures.
    
    JSHC.Fixity.translateInfixMember(ast, "exp");
    // handle sub-expressions afterwards
    JSHC.Fixity.translateInfixLists(ast.exp);
};

/*
JSHC.Fixity.translateInfixLists["infix-app"] = function(ast){
    JSHC.Fixity.translateInfixMember(ast, "lhs");
    JSHC.Fixity.translateInfixMember(ast, "rhs");
    // handle sub-expressions afterwards
    JSHC.Fixity.translateInfixLists(ast.lhs);
    JSHC.Fixity.translateInfixLists(ast.rhs);
};
*/

JSHC.Fixity.translateInfixLists["case"] = function(ast) {
    JSHC.Fixity.translateInfixMember(ast, "exp");
    JSHC.Fixity.translateInfixLists(ast.exp);
    
    for (var i = 0; i < ast.alts.length; i++) {
        JSHC.Fixity.translateInfixMember(ast.alts[i], "exp");
        JSHC.Fixity.translateInfixLists(ast.alts[i].exp);
    }
};

JSHC.Fixity.translateInfixLists["negate"] = function(ast){
    JSHC.Fixity.translateInfixMember(ast, "exp");
    JSHC.Fixity.translateInfixLists(ast.exp);
};

JSHC.Fixity.translateInfixLists["ite"] = function(ast){
    JSHC.Fixity.translateInfixMember(ast, "e1");
    JSHC.Fixity.translateInfixLists(ast.e1);
    JSHC.Fixity.translateInfixMember(ast, "e2");
    JSHC.Fixity.translateInfixLists(ast.e2);
    JSHC.Fixity.translateInfixMember(ast, "e3");
    JSHC.Fixity.translateInfixLists(ast.e3);
};

JSHC.Fixity.translateInfixLists["application"] = function(ast){
    var i;
//    alert("App contains: " + JSHC.showAST(ast));
    for(i=0;i<ast.exps.length;i++){
	ast.exps[i] = JSHC.Fixity.translateInfixExp(ast.exps[i]);
	JSHC.Fixity.translateInfixLists(ast.exps[i]);
    }
};

JSHC.Fixity.translateInfixLists["tuple"] = function(ast){
    var i;
//    alert("App contains: " + JSHC.showAST(ast));
    for(i=0;i<ast.members.length;i++){	
//        JSHC.alert("translating this tuple member;", ast.members[i]);    
	ast.members[i] = JSHC.Fixity.translateInfixExp(ast.members[i]);
//	JSHC.alert("translated this tuple member;", ast.members[i]);
	JSHC.Fixity.translateInfixLists(ast.members[i]);
    }
};

JSHC.Fixity.translateInfixLists["listexp"] = JSHC.Fixity.translateInfixLists["tuple"];

JSHC.Fixity.translateInfixLists["lambda"] = function(ast) {
    JSHC.Fixity.translateInfixMember(ast, "rhs");
    JSHC.Fixity.translateInfixLists(ast.rhs);
};

JSHC.Fixity.translateInfixLists["varname"] = function(ast){
    // nothing
};

JSHC.Fixity.translateInfixLists["dacon"] = function(ast){
    // nothing
};

JSHC.Fixity.translateInfixLists["integer-lit"] = function(ast){
    // nothing
};

JSHC.Fixity.translateInfixLists["qop"] = function(ast){
    // nothing
};

JSHC.Fixity.translateInfixLists["fixity"] = function(ast){
    // nothing
};

JSHC.Fixity.translateInfixLists["type-signature"] = function(ast){
    // nothing
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Check/addToplevelNamespace.js ---
////////////////////////////////////////////////////////////////////////////////

/*
  creates a namespace containing all top-level declarations and writes it to
  '.body.tspace' in the module AST.
  the namespace maps non-qualified names to name objects.

  qualifies all declared names with the name of the current module.

  adds information to data constructors so that one knows which type
  constructor it belongs to.
*/
JSHC.addToplevelNamespace = function(comp, module){
    assert.ok(module !== undefined, "addToplevelNamespace: input is not a module")
    var ns,i,j;
    ns = {};

    // TODO: must check that declarations do not overlap.
    //       i.e for any name added to the tspace, check if it already exists.
    //       return a list of errors ?
    //       e.g if data constructors overlap between different datatypes,
    //       it must be tested for here, as it will not be found later on.

    // Can not give a fixity signature for an imported name.
    // must check that for each fixity declaration, the name exists in the
    // tspace in the AST body.

    module.body.spaces = {};
    var spaces = module.body.spaces;
    spaces.signature = {};
    spaces.fixity = {};

    var ts = module.body.topdecls;
    for(i=0;i<ts.length;i++){
        if( ts[i].name === "topdecl-decl" ){
            var decl = ts[i].decl;
            switch( decl.name ){
            case "fixity":
            case "type-signature":
                continue;

            case "decl-fun":
                // qualify name and add to tspace
                var varname = ts[i].decl.ident;
                assert.ok( varname.loc === undefined );
                varname.loc = module.modid.id;
                // add first occurence
                if( ns[varname.toString()] === undefined ){
                    ns[varname.toString()] = varname;
                }
            }
        } else if( ts[i].name === "topdecl-data" ){
            // add type constructor
            var tycon = ts[i].typ.tycon;
            assert.ok( tycon.loc === undefined );
            tycon.loc = module.modid.id;
            ns[tycon.toString()] = tycon;
            // add all data constructors
            for(j=0;j<ts[i].constrs.length;j++){
                var dacon = ts[i].constrs[j].dacon;
                assert.ok( dacon.loc === undefined );
                dacon.loc = module.modid.id;
                dacon.memberOf = tycon;
                ns[dacon.toString()] = dacon;
            }
        } else {
            throw new JSHC.CompilerError("unknown top-level declaration");
        }
    }
/*
    for(i=0 ; i<ts.length ; i++){
        if( ts[i].name === "topdecl-decl" ){
            var decl = ts[i].decl;
            if( decl.name == "type-signature" ){
                for (j=0; j<decl.vars.length; j++ ) {
                    var name = decl.vars[i];
                    if( ns[name] === undefined ){
                        onError("signature declaration but no definition of "+name.toStringQ());
                    } else {
                        ns[name].sig = decl.sig;
                    }
                }
            }
        }
    }
*/
    module.body.tspace = ns;

    JSHC.addFixity(comp, module, ns);
};

////////////////////////////////////////////////////////////////////////////////

/*
  produces a map from operator name (both id and symbol possible) to
  {fix,prec} object.
*/
JSHC.addFixity = function(comp,module_ast,ns) {
    assert.ok(module_ast.name === "module", "argument to Fixity.findInfo must be a module AST!");
    var decls = module_ast.body.topdecls;
    for (var d=0 ; d<decls.length ; d++) {
        if (decls[d].name === "topdecl-decl") {
            if (decls[d].decl.name === "fixity") {
                var ops = decls[d].decl.ops;
                for (var i = 0; i < ops.length; i++ ) {
                    var name = ns[ops[i]];
                    if( name === undefined ){
                        comp.onError("fixity declaration but no definition of "+ops[i].toStringQ());
                    } else {
                        ns[ops[i]].fixity = {fix: decls[d].decl.fix, prec: decls[d].decl.num.value};
                    }
                }
            }
        }
    }
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Check/Dep.js ---

if( JSHC.Dep === undefined ){
    JSHC.Dep = {};
}

////////////////////////////////////////////////////////////////////////////////

/*
  Takes a list of entries and an action to perform for each dependency group.
*/
JSHC.Dep.check = function(entries, action){
    var entrymap = {};

    var known_names = {};

    if( entries instanceof Array ){
        entries.forEach(function(entry){
            //JSHC.alert("entry("+entry.values.length+"): ",entry);
	    for(var name in entry.names){
		entrymap[name] = entry;
		for(var i=0 ; i<entry.names ; i++){
		    assert.ok( known_names[entry.names[i]] === undefined );
		    known_names[entry.names[i]] = null;
		}
	    }
	});
    } else {
        for(var entry in entries){
            entrymap[entry] = entries[entry];
	    for(var i=0 ; i<entry.names ; i++){
		assert.ok( known_names[entry.names[i]] === undefined );
		known_names[entry.names[i]] = null;
	    }
        }
    }

    var entrylist = JSHC.Dep.condense(entrymap);

    //JSHC.alert("CONDENSE DONE");

    //entrylist.forEach(function(entry){
    //    JSHC.alert("entry("+entry.values.length+"): ",entry);
    //});

    JSHC.Dep.removeSelfDeps(entrymap);

    JSHC.Dep.transpose(entrymap);

    var t = new JSHC.Dep.Traverse(entrymap, entrylist);

    while( !t.isDone() ){
	var e = t.takeOne();
	assert.ok( e !== undefined, "takeOne must return non-undefined when isDone is false" );
	action(e);
	t.done(e);
    }
};

////////////////////////////////////////////////////////////////////////////////

/*
  Removes dependencies to itself from entries.
*/
JSHC.Dep.removeSelfDeps = function(entries){
    for(name in entries){
	var entry = entries[name];
        if( entry.ins[name] !== undefined ){
             delete entry.ins[name];
        }
    }
};

////////////////////////////////////////////////////////////////////////////////

/*
  For each incoming edge (dependency), add an outgoing edge on the opposite
  entry. This is needed for the traversal.
*/
JSHC.Dep.transpose = function(entries){
    var name;

    for(name in entries){
	var entry = entries[name];

	if( entry.deps !== undefined ){
	    continue;
	}
	
	// compute number of dependencies
	var deps = 0;
	var depmap = {};
	for(var i in entry.ins){
	    var depname = entries[i].name;
	    if( depmap[depname] === undefined ){
	        depmap[depname] = null;
	        deps++;
	    }
	}
	entry.deps = deps;

	// create outgoing edges for all incoming edges
	for(var inEdge in entry.ins){
	    // add outgoing edge
	    //assert.ok( this.namemap[inEdge].names.indexOf(inEdge) !== -1 );
	    if( entries[inEdge].outs === undefined ){
		entries[inEdge].outs = {};
	    }
	    entries[inEdge].outs[entry.name] = null;
	}
    }
};

////////////////////////////////////////////////////////////////////////////////

/*
  Constructor of an object that is used to traverse the graph in dependency
  order.
*/
JSHC.Dep.Traverse = function(entrymap, entrylist){
    this.entries = entrymap;
    this.waiting = {};
    this.ready = {};

    for(var i=0 ; i<entrylist.length ; i++){
	var key = entrylist[i].name;
	if( entrylist[i].deps === 0 ){
	    delete entrylist[i].deps;
	    this.ready[key] = entrylist[i];
	} else {
	    this.waiting[key] = entrylist[i];
	}
    }
};

/*
  Take one entry from the ready set.
  If the ready set is empty, undefined is returned.
*/
JSHC.Dep.Traverse.prototype.takeOne = function(){
    var k = undefined;

    for(k in this.ready){ // ready : map
	break;
    }
    if( k === undefined ){
        if( !this.isDone() ){
            JSHC.alert("remaining: ",this.remaining(),"entries waiting for nothing: ",this.waiting);
        }
        return undefined;
    }

    var entry = this.ready[k];
    delete this.ready[k];
    return entry;
};

/*
  Take all entries from the ready set.
*/
JSHC.Dep.Traverse.prototype.takeAll = function(){
    var es = [];
    while(true){
	var e = this.takeOne();
	if( e === undefined )break;
	es.push(e);
    }
    return es;
};

/*
  Return an entry that was taken out.
*/
JSHC.Dep.Traverse.prototype.done = function(entry){

    for(var out in entry.outs){
	// for each of the entries (in the waiting list) exported to:
	// decrease number of imports.
	// if reaching zero, then move from the waiting set to ready set.
	this.entries[out].deps--;
	assert.ok( this.entries[out].deps >= 0 );
	if( this.entries[out].deps === 0 ){
	    assert.ok( this.waiting[out] !== undefined );
	    this.ready[out] = this.waiting[out];
	    delete this.waiting[out];
	    delete this.entries[out].deps;
	}
    }
};

/*
  Return the number of remaining entries.
*/
JSHC.Dep.Traverse.prototype.remaining = function(){
    var remaining = 0;
    for(var k in this.ready){
	remaining++;
    }
    for(var k in this.waiting){
	remaining++;
    }
    return remaining;
};

/*
  Return true if and only if the traversal is done.
*/
JSHC.Dep.Traverse.prototype.isDone = function(){
    for(var k in this.ready){
	return false;
    }
    for(var k in this.waiting){
	return false;
    }
    return true;
};

////////////////////////////////////////////////////////////////////////////////

/*
  Entry constructor.
  Takes list of values, list/set of names, and list/set of edges.

  contains:
    values: any objects. this is e.g modules or topdecls.
    names: declared names. strings. e.g module/topdecl name.
    edges: used names. strings. e.g used names in an expression.

  build internally:
    outs: entries that refer to this entry
    ins: entries that the entry is referring to
*/
JSHC.Dep.Entry = function(values,names,edges){
    assert.ok( values instanceof Array, "values are "+values );

    // initialize "values"
    this.values = values;

    // initialize "names"
    this.names = {};
    if( names instanceof Array ){
        this.name = names[0];
        for(var k=0 ; k<names.length ; k++){
	    this.names[names[k]] = null;
        }
    } else {
        for(var k in names){
            if( this.name === undefined ){
                this.name = names[k];
            }
	    this.names[names[k]] = null;
        }
    }
    assert.ok( this.name !== undefined );

    // initialize "ins"
    this.ins = {};
    if( edges instanceof Array ){
        for(var k=0 ; k<edges.length ; k++){
	    this.ins[edges[k]] = null;
        }
    } else {
        for(var k in edges){
	    this.ins[edges[k]] = null;
        }
    }
};

/*
  Used to merge entries when condensing the graph.
*/
JSHC.Dep.Entry.prototype.addIncoming = function(edge){
    if( this.names[edge] !== undefined ){
	return;
    }
    this.ins[edge] = null;
};

/*
  Used to merge entries when condensing the graph.
*/
JSHC.Dep.Entry.prototype.addName = function(name){
    this.names[name] = null;   // add name
    delete this.ins[name];
};

JSHC.Dep.Entry.prototype.addValue = function(value){
    this.values.push(value);
};

JSHC.Dep.Entry.prototype.toString = function(){
    var d = ["{"];
    for(var name in this.names){
	    d.push(name);
	    d.push(", ");
    }
    d.pop();
    d.push("}");
    return d.join("");
};

////////////////////////////////////////////////////////////////////////////////

/*
  Condenses a graph by merging some nodes to create a directed acyclic graph.
  Takes a mapping from names to entries. Each entry may have multiple names.

  The function updates the map to remove old entries (and replace it with what
  it was merged into), and returns a list of the remaining entries.
*/
JSHC.Dep.condense = function(old_entries){
    assert.ok( old_entries instanceof Object );

    // eop: entries on path
    var eop = [];
    // list of the remaining entries. entries that are done are added.
    var new_entries = [];

    // ce: current entry
    var condense = function(ce) {
	assert.ok( ce instanceof JSHC.Dep.Entry );

        //JSHC.alert("name: "+ce.name,"\nnames: "+ce.names,"\ndeps: ",ce.ins);

	var merged_entry;

	// compute index of ce in eop
	if( eop.indexOf(ce) >= 0 ){ // if eop contains ce
	    // found a cycle. return and merge other entries into this entry.
	    ce.status = "merged";
	    new_entries.push(ce);
	    return ce;
	} else {
	    eop.push(ce);
	}

	// the edges will be included into another entry if it is part of a
	// cycle, and then the loop continues to add the rest of the edges to
	// the merged entry.
	for(var depname in ce.ins){
	    var dep = old_entries[depname];
	    assert.ok( dep !== undefined, "missing dependency of an entry: "+depname);

            //JSHC.alert("depname: ",depname,"\nnames: ",ce.names,"\ndeps: ",ce.ins);
	    //JSHC.alert("depname: ",depname,"\nnames: ",ce.names,"\ndeps: ",ce.ins,"\nentry: ",dep);

	    // skips edge if it is to itself, or if already checked.
	    if( dep === ce || dep.status !== undefined ){
		// dep already checked, so NOT connected with ce.
		continue;
	    }
	    
	    // dependency is some other unchecked entry, so check it.
	    //JSHC.alert("recursive call. entry. stack("+eop.length+"): ",eop);
	    merged_entry = condense(dep);
	    //JSHC.alert("recursive call. exit. stack("+eop.length+"): ",eop);
	    assert.ok( dep.status !== undefined );
	    
	    //JSHC.alert("group "+dep+" checked",
	    //           "\ndep.status is "+dep.status,
	    //           "\nmerged_entry: ",merged_entry+"",
	    //           "\nnow in: ",ce+"");

            // check if 'dep' connected with 'ce'.

	    if( merged_entry === null ){
		assert.ok( dep.status !== "removed" );
		// found to be NOT connected with 'ce'.
		continue;
	    }

            assert.ok( merged_entry.status == "merged" );

            // check for beginning of cycle
	    if( merged_entry === ce ){
		assert.ok( dep.status == "removed", "status is "+dep.status );
		// found beginning of cycle.
		// stop merging by returning null.
		eop.pop();
		return null;
	    } else {
		// merge 'ce' into 'merged_entry'.
                assert.ok( ce.status === undefined );

                // add all values
		for(var ix=0 ; ix<ce.values.length ; ix++){
		    merged_entry.addValue(ce.values[ix]);
                }

		// add all edges
		for(var edge in ce.ins){
		    merged_entry.addIncoming(edge);
		}

		for(var name in ce.names){
		    // add all names
		    merged_entry.addName(name)

		    // when merging an entry A into an entry B, then A must be
		    // removed by referring to the merged entry instead.
		    // do this by moving all names from ce to the merged_entry.
		    // this affects the loop over dependencies, as one would not
		    // want to access old entries.
		    old_entries[name] = merged_entry;
		}
		
		// later on one might want to include the 'ce' into another
		// cycle, i.e merge the two cycles, so 'ce' must be referring
		// to the cycle ('merged_entry').
		ce.status = "removed";
		ce = merged_entry;
		continue;
	    }
	} // end of loop over dependencies/edges
	
	if( ce.status === undefined ){
	    // if status has not been set, then it is not part of any cycle.
	    ce.status = "single"
	    new_entries.push(ce);

	    eop.pop();
	    return null;
	} else {
	    // if status was set, then it must have been part of a cycle,
	    // so the status must have been set to merged.
	    assert.ok( ce.status === "merged", "status was "+ce.status );

	    eop.pop();
	    return ce;
	}
    }

    for(var oe in old_entries){
	if( old_entries[oe].status !== undefined ){
	    continue;
	}

	condense(old_entries[oe]);
	assert.ok( eop.length === 0 );
    }

    return new_entries;
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Simplify/Simplify.js ---

////////////////////////////////////////////////////////////////////////////////

JSHC.Simplify.runSimplify = function(ast) {
    JSHC.Simplify.ast_modid = ast.modid
//    JSHC.alert("SIMPLIFYING:\n\n", ast); 
    JSHC.Simplify.patSimplifyTop(ast);
//    alert("AFTER patsimplify:\n\n" + JSHC.showAST(ast))
    JSHC.Simplify.simplifyModule(ast);
//    alert("AFTER simplify:\n\n" + JSHC.showAST(ast))
    JSHC.Simplify.renameLocalNames(ast);
}

//JSHC.Simplify.simplify = function(ast){
//    assert.ok( ast !== undefined && ast.name !== undefined, "param 'ast' must be an AST");
//    var f = this.simplify[ast.name];
//    if( f === undefined ){
//        throw new Error("no definition for "+ast.name);
//    }
//    assert.ok( f instanceof Function, ast.name+" <: Function." )
//    f.call(this,ast);
//};

JSHC.Simplify.simplifyModule = function(ast){
    JSHC.Simplify.simplifyBody(ast.body);
};

JSHC.Simplify.simplifyBody = function(ast){
    var i;
    var ts = ast.topdecls;
    for(i=0;i<ts.length;i++){
        if( ts[i].name === "topdecl-data" ){
            // no simplification of data types is needed.

            //if( i !== ts.length-1 ){
            //    ts[i] = ts[ts.length-1];
            //    i--;
            //}
            //ts.pop();
        } else if( ts[i].name === "topdecl-decl" ){
	    if( ts[i].decl.name == "type-signature" ||
                // remove type-signature and fixity
	        ts[i].decl.name == "fixity" ){
                if( i !== ts.length-1 ){
                    ts[i] = ts[ts.length-1];
                    i--;
                }
                ts.pop();
	    } else {
	        JSHC.Simplify.simplifyDeclFun(ts[i].decl);
	    }
	}
    }
};

JSHC.Simplify.simplifyDeclFun = function(ast){
    // take all parameters in the LHS and add as lambdas on the RHS.

    var i;
    var new_rhs;
    
    if (ast.rhs.name === "fun-where") {
    	//JSHC.alert("args.length", ast.args.length);
    	new_rhs = ast.rhs;
    	new_rhs.decls = JSHC.Simplify.patSimplifyDecls(new_rhs.decls);
    	for (var i = 0; i < new_rhs.decls.length; i++) {
	    JSHC.Simplify.simplifyDeclFun(new_rhs.decls[i]);
    	}
    	new_rhs.exp = JSHC.Simplify.reduceExp(new_rhs.exp);
    } else {
    	new_rhs = JSHC.Simplify.reduceExp(ast.rhs);
    }
    
    if(ast.args.length > 0) {
    	//JSHC.alert("making lambdas", ast, "with new_rhs:", new_rhs);
        ast.rhs = {name:"lambda", args: ast.args, rhs: new_rhs, pos: ast.pos};
        ast.args = [];
    } else {
        ast.rhs = new_rhs;
    }
};

JSHC.Simplify.reduceExp = function (exp) {
//        var exp = e.exps[0];
        switch (exp.name) {
            case "ite":
                var tru = {name: "alt", pat: new JSHC.DaCon("True", exp.e2.pos, false), 
                           exp: JSHC.Simplify.reduceExp(exp.e2)};
                var fals = {name: "alt", pat: new JSHC.DaCon("False", exp.e3.pos, false), 
                           exp: JSHC.Simplify.reduceExp(exp.e3)};            
                exp = {name: "case", exp: JSHC.Simplify.reduceExp(exp.e1), 
                             alts: [tru,fals]};
                break;

            case "lambda":
                var rhs_new = JSHC.Simplify.reduceExp(exp.rhs)
                var dummy = {name: "decl-fun", args: exp.args, rhs: rhs_new};
                dummy = JSHC.Simplify.merge([dummy]);
                exp = {name: "lambda", args: dummy.args, rhs: dummy.rhs, pos: exp.pos};
                //if (JSHC.Simplify.ast_modid.toString() === "Lambda")
                //	JSHC.alert("SIMPLIFIED A LAMBDA in " + JSHC.showAST(JSHC.Simplify.ast_modid) + "!\n\n",exp); 
                break;

            case "let":
            	exp.decls = JSHC.Simplify.patSimplifyDecls(exp.decls);
            	for (var i = 0; i < exp.decls.length; i++) {
                    JSHC.Simplify.simplifyDeclFun(exp.decls[i]);
                }
                JSHC.Simplify.reduceExp(exp.exp);
                //new_exp = {name:"application", exps: [new_exp], pos: new_exp.pos}
                //new_exp = {name:"infixexp", exps:[new_exp], pos: new_exp.pos};
                break;

            case "conpat":
                var new_pats = [];
                for(var ix=0 ; ix<exp.pats.length ; ix++ ){
                    new_pats.push(JSHC.Simplify.reduceExp(exp.pats[ix]));
                }
                exp = {name: exp.name,
                       con: JSHC.Simplify.reduceExp(exp.con),
                       pats: new_pats};
                break;

            case "tuple_pat":
            case "tuple":
                var new_members = [];
                for(var ix=0 ; ix<exp.members.length ; ix++ ){
                    new_members.push(JSHC.Simplify.reduceExp(exp.members[ix]));
                }
                exp = {name:exp.name,members:new_members};
                break;

            case "listexp":
                var list = new JSHC.NilDaCon();
                var cons = new JSHC.ConsDaCon();
                for(var ix=exp.members.length-1 ; ix>=0 ; ix-- ){
                    list = {name:"application",exps:[cons,JSHC.Simplify.reduceExp(exp.members[ix]),list]};
                }
                exp = list;
                break;

            case "case":
                var new_exp = JSHC.Simplify.reduceExp(exp.exp);
                var new_alts = [];
                for(var ix=0 ; ix<exp.alts.length ; ix++ ){
                    new_alts.push(JSHC.Simplify.reduceExp(exp.alts[ix]));
                }
                exp = {name:"case",exp:new_exp,alts:new_alts};
                break;

            case "alt":
                exp = {name: "alt",
                       exp: JSHC.Simplify.reduceExp(exp.exp),
                       pat: JSHC.Simplify.reduceExp(exp.pat)};
                break;

            case "application":
                var new_exps = [];
                for(var ix=0 ; ix<exp.exps.length ; ix++ ){
                    new_exps.push(JSHC.Simplify.reduceExp(exp.exps[ix]));
                }
                exp = {name:"application",exps:new_exps};
                break;

            case "wildcard":
            case "varname":
            case "dacon":
            case "integer-lit":
                break;

            default:
                throw new JSHC.CompilerError("Simplify.reduceExp not defined for " + exp.name);
        }
    return exp;
};

JSHC.Simplify.reduceWhere = function (e) {
    
    var new_exp = {name:"tuple",members: [],pos: e.decls.pos};
    var new_pat = {name:"tuple_pat", members: [],pos: e.decls.pos};
    for (var i = 0; i < e.decls.length; i++) {
        var temp = e.decls[i];
        JSHC.Simplify.simplifyDeclFun(temp);
        switch (temp.name) {
            case "decl-fun":
                new_exp.members.push(temp.rhs);
                new_pat.members.push(temp.ident);
                break;
            default:
                throw new Error("Simplify.reduceExp not defined for " + exp.decls[i].name);
        }
    }
    //new_exp = {name:"application", exps: [new_exp], pos: new_exp.pos};
    //new_exp = {name:"infixexp", exps:[new_exp], pos: new_exp.pos};
                
    var new_case = {name:"case", exp: new_exp, 
                             alts: [{name:"alt", pat: new_pat, exp: e.exp}]};

    return new_case; //{name: "infixexp", exps: [new_case], pos: e.pos}
};

/*
  merge top-decls for same identifier
*/
JSHC.Simplify.patSimplifyTop = function (ast) {
//    alert("RUNNING PATSIMPLIFY on: " + ast.modid)
    var old = ast.body.topdecls;
    var newbody = [];
    var toMerge = {};

    for (var i = 0; i < old.length; i++) {
        if (old[i].name === "topdecl-decl" && old[i].decl.name === "decl-fun") {
            var fun = old[i].decl;

            if (toMerge[fun.ident.id] === undefined)
                toMerge[fun.ident.id] = [];
               
            toMerge[fun.ident.id].push(fun);
        } else {
            newbody.push(old[i]);
        }

    }
    for (var k in toMerge) {
        newbody.push({name: "topdecl-decl", decl: JSHC.Simplify.merge(toMerge[k])} );
    }

    ast.body.topdecls = newbody;
};

JSHC.Simplify.patSimplifyDecls = function(ast) {
	var newdecls = [];
	var toMerge = {};
	
	for (var i = 0; i < ast.length; i++)  {
		if (ast[i].name === "decl-fun") {
			var fun = ast[i];
			
			if (toMerge[fun.ident.id] === undefined)
				toMerge[fun.ident.id] = [];
				
			toMerge[fun.ident.id].push(fun);
		} else {
			newdecls.push(ast[i]);
		}
	}
	for (var k in toMerge) {
		newdecls.push(JSHC.Simplify.merge(toMerge[k]));
	}
	
	return newdecls;
};

JSHC.Simplify.merge = function(funs) {
      
      assert.ok(funs.length > 0, "JSHC.Simplify.merge() shouldn't be called with a list of 0 length")
        // check whether a one line function uses matching on its arguments      
      var hasMatching = false;
      for (var i = 0; i < funs[0].args.length; i++) {
          if (funs[0].args[i].name !== "varname" ) {
                hasMatching = true;
                break;
          }
      }
      
      if (funs.length > 1 || hasMatching) {
          var newArgs = [];
          var newAlts = [];
          var newArgsT = [];
          //calculate the new argument list
          for (var j = 0; j < funs[0].args.length; j++) {
              var vrnm = new JSHC.VarName("a" + j, funs[0].pos, false);
              newArgs.push(vrnm);
              //newArgsT.push(vrnm);
          }
          
          newArgsT = {name: "tuple", members: newArgs};
//          alert("newargst:\n" + JSHC.showAST(newArgsT) + "\nnewargs:\n" + JSHC.showAST(newArgs))
          //calculate the alts for the case-expression
          for (var j = 0; j < funs.length; j++) {
              var argsT = {name: "tuple_pat", members: funs[j].args}
              newAlts.push( {name: "alt", pat: argsT, exp: funs[j].rhs} );
          }
          
          //merge the different functions into one with a case-expression                  
          var newRhs = {name: "case", exp: newArgsT, alts: newAlts};
          var res = {name: "decl-fun", ident: funs[0].ident, args: newArgs, rhs: newRhs};
          //res = {name: "topdecl-decl", decl: res}
          
          //push the merged function into the new body
//          alert("pushed a merged function: " + JSHC.showAST(res))
          return res;
      } else if (funs.length === 1){
//          alert("pushed a non-merged function: " + JSHC.showAST(funs[0]))
          return funs[0];
      }
}

////////////////////////////////////////////////////////////////////////////////

JSHC.Simplify.renameLocalNames = function(ast){
    var topdecls = ast.body.topdecls;

    var usednames = new JSHC.Set(false);

    // find all declared and used names in sub-expressions and add to a set
    // starting with all top-level variable names. any local renames will work
    // as long as no names in this set is used.
    for (var ix = 0; ix < topdecls.length; ix++) {
        if (topdecls[ix].name === "topdecl-decl" && topdecls[ix].decl.name === "decl-fun") {
            JSHC.Simplify.findUsedNamesInDecl(usednames, topdecls[ix].decl);
        }
    }

    // rename local names
    var namemaps = [{}];
    for (var ix = 0; ix < topdecls.length; ix++) {
        if (topdecls[ix].name === "topdecl-decl" && topdecls[ix].decl.name === "decl-fun") {
            JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, topdecls[ix].decl.rhs);
        }
    }
};

JSHC.Simplify.renameLocalDeclaredName = function(usednames, namemaps, old_name){

    // check if valid javascript name. if so, do not change it.
    if( old_name.id.match(/[a-zA-Z][a-zA-Z0-9_]*/) ){
        return old_name;
    }

    var old_ident = old_name.id;
    var new_ident = [];

    // produce a new name
    for(var ix=0 ; ix<old_ident.length ; ix++ ){
        var ch = old_ident[ix];
        if( ch.match(/[a-zA-Z0-9_]/) ){
            new_ident.push(ch);
            continue;
        }
        switch( old_ident[ix] ){
        case '!': new_ident.push("bang"); break;
        case '#': new_ident.push("hash"); break;
        case '$': new_ident.push("buck"); break;
        case '%': new_ident.push("mod"); break;
        case '&': new_ident.push("and"); break;
        case '*': new_ident.push("star"); break;
        case '+': new_ident.push("plus"); break;
        case '.': new_ident.push("dot"); break;
        case '/': new_ident.push("slash"); break;
        case '<': new_ident.push("lt"); break;
        case '=': new_ident.push("eq"); break;
        case '>': new_ident.push("gt"); break;
        case '?': new_ident.push("maybe"); break;
        case '@': new_ident.push("at"); break;
        case '\\':new_ident.push("back"); break;
        case '^': new_ident.push("roof"); break;
        case '|': new_ident.push("bar"); break;
        case '-': new_ident.push("sub"); break;
        case '~': new_ident.push("tilde"); break;
        case ':': new_ident.push("colon"); break;
        default:  new_ident.push("_");
        }
    }
    new_ident = new_ident.join("");

    // make sure the new name is unique
    var number = 0;
    while( usednames.contains(new_ident+number) === true ){
        number++;
    }
    new_ident = new_ident + number;

    // create new name using the new ident
    new_name = new JSHC.VarName(new_ident,{},false);

    // must add new name to both 'usednames' and 'namemaps'.
    namemaps[namemaps.length-1][old_ident] = new_name;
    usednames.add([new_ident]);

    //JSHC.alert("renameLocalName: declared: \n",new_ident,"\ninstead of\n",old_ident);

    return new_name;
};

JSHC.Simplify.renameLocalUsedName = function(usednames, namemaps, name){
    // ignore qualified names
    if( name.loc !== undefined ){
        return name;
    }

    var replacement;
    for(var ix=namemaps.length-1 ; ix>=0 ; ix--){
        replacement = namemaps[ix][name.id];
	if( replacement !== undefined ){
	    break;
	}
    }
    if( replacement === undefined )return name;

    //JSHC.alert("renameLocalName: used:\n",name);

    assert.ok( replacement instanceof JSHC.VarName );
    return replacement;
};

JSHC.Simplify.renameLocalNamesInDecl = function(usednames, namemaps, decl){

    // rename declared name
    decl.ident = JSHC.Simplify.renameLocalDeclaredName(usednames, namemaps, decl.ident);

    namemaps.push({});

    // rename names in patterns
    for(var ix=0; ix < decl.args.length ; ix++ ){
        decl.args[ix] = JSHC.Simplify.renameLocalNamesInPat(usednames, namemaps, decl.args[ix]);
    }

    // rename names in the RHS
    decl.rhs = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, decl.rhs);

    namemaps.pop();
};

/*
    returns the new pattern
*/
JSHC.Simplify.renameLocalNamesInPat = function(usednames, namemaps, pat){
    switch (pat.name) {
    case "varname":
        return JSHC.Simplify.renameLocalDeclaredName(usednames, namemaps, pat);

    case "tuple_pat":
        // rename within each member in exp.members
        for(var ix=0 ; ix<pat.members.length ; ix++){
            pat.members[ix] = JSHC.Simplify.renameLocalNamesInPat(usednames, namemaps, pat.members[ix]);
        }
        return pat;

    case "dacon":
    case "integer-lit":
        return pat;

    case "conpat":
        // rename within each pat in pat.pats
        for(var ix=0 ; ix<pat.pats.length ; ix++){
            pat.pats[ix] = JSHC.Simplify.renameLocalNamesInPat(usednames, namemaps, pat.pats[ix]);
        }
        return pat;

    case "wildcard":
        return pat;

    default:
        throw new JSHC.CompilerError("Simplify.renameLocalNamesInPat not defined for " + pat.name);
    }
};

/*
    returns the new expression
*/
JSHC.Simplify.renameLocalNamesInExp = function(usednames, namemaps, exp){
    switch (exp.name) {
    case "lambda":
        // rename in each pattern
        for(var ix=0 ; ix<exp.args.length ; ix++){
            exp.args[ix] = JSHC.Simplify.renameLocalNamesInPat(usednames, namemaps, exp.args[ix]);
        }

        exp.rhs = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, exp.rhs);
        return exp;

    case "tuple":
        // rename within each member in exp.members
        for(var ix=0 ; ix<exp.members.length ; ix++){
            exp.members[ix] = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, exp.members[ix]);
        }
        return exp;

    case "case":
        // rename within exp.exp
        exp.exp = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, exp.exp);

        // rename within each alternative alt in exp.alts
        for(var ix=0 ; ix<exp.alts.length ; ix++){
            exp.alts[ix].pat = JSHC.Simplify.renameLocalNamesInPat(usednames, namemaps, exp.alts[ix].pat);
            exp.alts[ix].exp = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, exp.alts[ix].exp);
        }
        return exp;

    case "application":
        // rename within each exp in exp.exps
        for(var ix=0 ; ix<exp.exps.length ; ix++){
            exp.exps[ix] = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, exp.exps[ix]);
        }
        return exp;

    case "fun-where":
    case "let":
        namemaps.push({});
        for(var ix=0 ; ix<exp.decls.length ; ix++){
            JSHC.Simplify.renameLocalNamesInDecl(usednames, namemaps, exp.decls[ix]);
        }
        exp.exp = JSHC.Simplify.renameLocalNamesInExp(usednames, namemaps, exp.exp);
        namemaps.pop();
        return exp;

    case "dacon":
    case "integer-lit":
        return exp;

    case "varname":
        return JSHC.Simplify.renameLocalUsedName(usednames, namemaps, exp);

    default:
        throw new JSHC.CompilerError("Simplify.renameLocalNamesInExp not defined for " + exp.name);
    }
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Simplify.findUsedNamesInDecl = function(usednames, decl){
    usednames.add(decl.ident.id);
    for(var ix=0; ix < decl.args.length ; ix++ ){
        JSHC.Simplify.findUsedNamesInPat(usednames, decl.args[ix]);
    }
    JSHC.Simplify.findUsedNamesInExp(usednames, decl.rhs);
};

JSHC.Simplify.findUsedNamesInPat = function(usednames, pat){
    switch (pat.name) {
    case "varname":
        usednames.add(pat.id);
        break;

    case "tuple_pat":
        for(var ix=0 ; ix<pat.members.length ; ix++){
            JSHC.Simplify.findUsedNamesInPat(usednames, pat.members[ix]);
        }
        break;

    case "dacon":
    case "integer-lit":
        break;

    case "conpat":
        // rename within each pat in pat.pats
        for(var ix=0 ; ix<pat.pats.length ; ix++){
            JSHC.Simplify.findUsedNamesInPat(usednames, pat.pats[ix]);
        }
        break;

    case "wildcard":
        break;

    default:
        throw new JSHC.CompilerError("Simplify.findUsedNamesInPat not defined for " + pat.name);
    }
};

/*
    returns the new expression
*/
JSHC.Simplify.findUsedNamesInExp = function(usednames, exp){
    switch (exp.name) {
    case "lambda":
        for(var ix=0 ; ix<exp.args.length ; ix++){
            JSHC.Simplify.findUsedNamesInPat(usednames, exp.args[ix]);
        }
        JSHC.Simplify.findUsedNamesInExp(usednames, exp.rhs);
        break;

    case "tuple":
        for(var ix=0 ; ix<exp.members.length ; ix++){
            JSHC.Simplify.findUsedNamesInExp(usednames, exp.members[ix]);
        }
        break;

    case "case":
        JSHC.Simplify.findUsedNamesInExp(usednames, exp.exp);
        for(var ix=0 ; ix<exp.alts.length ; ix++){
            JSHC.Simplify.findUsedNamesInPat(usednames, exp.alts[ix].pat);
            JSHC.Simplify.findUsedNamesInExp(usednames, exp.alts[ix].exp);
        }
        break;

    case "application":
        for(var ix=0 ; ix<exp.exps.length ; ix++){
            JSHC.Simplify.findUsedNamesInExp(usednames, exp.exps[ix]);
        }
        break;

    case "fun-where":
    case "let":
        for(var ix=0 ; ix<exp.decls.length ; ix++){
            JSHC.Simplify.findUsedNamesInDecl(usednames, exp.decls[ix]);
        }
        JSHC.Simplify.findUsedNamesInExp(usednames, exp.exp);
        break;

    case "dacon":
    case "integer-lit":
        break;

    case "varname":
        usednames.add(exp.id);
        break;

    default:
        throw new JSHC.CompilerError("Simplify.findUsedNamesInExp not defined for " + exp.name);
    }
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Codegen/comUtils.js ---
JSHC.comUtils = new Object();
JSHC.Codegen = new Object();

//used to separate the qualifier part from a qvarid
JSHC.comUtils.splitQvarid = function(input) {
    var q, i;
    
    i = input.substr(input.lastIndexOf(".")+1);
    q = input.slice(0,input.lastIndexOf("."));

    return {i: i, q: q}
    
}

JSHC.comUtils.getBinds = function(exp, pat) {
    
    var res = []
    switch (pat.name) {
    case "conpat":
        for (var i = 0; i < pat.pats.length; i++) {
            res.push(pat.pats[i].id);
        }   
        break;
    case "tuple_pat":
        for (var i = 0; i < pat.members.length; i++) {
            res.push(pat.members[i].id);
        }
    case "varname":
        res.push(exp);
        break;
    case "dacon":
    case "integer-lit":
        break;
    default:
        throw new Error ("illegal pattern in getBinds: " + pat.name)
    }
    return res;
}

JSHC.comUtils.getBindStrs = function(p) {

    var res = []
    
    var inner = function (pat) {
        switch (pat.name) {
        case "conpat":
            for (var i = 0; i < pat.pats.length; i++) {
                inner(pat.pats[i]);
            }
            break;
        case "tuple_pat":
            for (var i = 0; i < pat.members.length; i++) {
                inner(pat.members[i]);
            }
            break;
        case "varname":
            res.push(pat.id);
            break;
        case "dacon":
        case "integer-lit":
        case "wildcard":
            break;
        default:
            throw new Error ("illegal pattern in getBinds: " + pat.name)
        }
    }
    inner(p);
    return res;
   
}


// --- src/Codegen/codegen.js ---
//require utility.js
//        Internal.lazy.js
//        Compile.comUtils

JSHC.Codegen.codegen = function (input,namespace) {
    if (namespace === undefined)
        namespace = "modules";
    assert.ok(typeof namespace === "string", "The supplied namespace must be of type String!");
    
//    try {
//    alert("ATTEMPTING COMPILATION OF AST: \n\n" + JSHC.showAST(input));
//    } catch (err) {
//        alert(JSHC.showError(err));
//    }
    var modid;
    
    var comModule = function(module) {
        if (module.name !== "module") 
           throw new Error("Top level node in AST is not a module, but a " + module.name);
           
        modid = namespace + "." + ((module.modid) ? module.modid.id : "Main");
//        if (module.exports) {
//           throw new Error ("compilation of exports not defined!");
//        }
        var res = "";
        JSHC.ModName.prefixes(module.modid.id).forEach(function(prefix){
            res += "if( "+namespace+"."+prefix+" === undefined ){ "+
                   namespace+"."+prefix+" = new Object(); }\n";
        });
        res += comBody(module.body);
        return res;
    }

    /*
        compiles into lazy expression
    */
    var comSoloExp = function(exp) {
        var code = comExp(exp);
        if( code[0] ){
            return "new JSHC.Thunk("+code[1]+")";
        } else {
            return code[1];
        }
    }

    var comBody = function(body) {
        if (body.name !== "body") 
            throw new Error("Module body is not of type body, but " + body.name);
            
        var res = ""
        for (var i = 0; i < body.topdecls.length; i++) {
            switch (body.topdecls[i].name) {
                case "topdecl-decl":
                    res += comDecl(body.topdecls[i].decl);
                    break;
                case "topdecl-data":
                    res += comData(body.topdecls[i]);
                    break;
                default:
                    throw new Error("comBody not defined for name " + body.topdecls[i].name);
            }
        }
        return res;
        
    }

    var comDecl = function(decl) {
        var res = ""
        switch (decl.name) {
            case "decl-fun":
                res = (modid + "[\"" + decl.ident.id + "\"]" + " = " + comRhs(decl.rhs)) + ";\n";
                break;
            default:
                throw new Error("comDecl not defined for name " + decl.name);
        }

        if( typeof res != "string" ){
            JSHC.alert("compiling\n",decl);
            JSHC.alert("to\n",res);
            throw new Error("stop");
        }

        return res;
    }

    var comRhs = function(rhs) {
       // not necessary for all RHSs to be lazy, but must avoid evaluating
       // the RHS when using global names that have no yet been defined outside
       // functions in the RHS.
       var code = comExp(rhs);
       //if( code[0] ){
       //    code = "new JSHC.Thunk("+code[1]+")";
       return "new JSHC.Thunk(function() {return " + code[1] + "})";
       //} else {
       //    code = code[1];
       //}
       //return "function(){" + code + "}"
    }

    var comExp = function(exp) {
        switch (exp.name) {
             case "application":
//                alert("compiling application of:\n " + JSHC.showAST(exp[i].exps));
                return comExpApp(exp);

             case "integer-lit":
                return comExpLit(exp);

             case "varname":
             case "dacon":
                return comExpName(exp);

             case "tuple":
                return comExpTuple(exp);

             case "lambda":
                return comExpLambda(exp);

             case "case":
//                alert("comCase:\n\n" + JSHC.showAST(exp[i]))
                return comExpCase(exp);
             case "let":
             case "fun-where":
             	//JSHC.alert("compilING:", exp);
             	var res = comExpDecls(exp);
             	//JSHC.alert("compiled:", res);
             	return res;
             default:
                throw new Error("comExp not defined for name " + JSHC.showAST(exp));
        }
    }

/*
    var comPat = function(pat) {

        var res = "";
        switch (pat.name) {
            case "dacon":
                res += "[\"" + pat.id  + "\"]";
                break;
            case "conpat":
                res += "[\"" + pat.con.id + "\","
                for (var i = 0; i < pat.pats.length; i++) {
                    res += comPat(pat.pats[i]) + ", ";
                }
                res += "]"
                break;
            case "varname":
                res += "\"" + pat.id + "\""
                break;
            default:
                throw new Error("comPat not defined for name " + pat.name);
        }
        return res;
    }
*/

    var comApat = function(apat) {

        var res = "";
        switch (apat.name) {
            case "varname":
//            case "var-op":
                res += apat.id;
                break;
            default:
                JSHC.alert("When compiling: \n\n", input)
                throw new Error("comApat not defined for name " + apat.name); 
        }
        return res;
        
    }

/*
    var comFexp = function(exp) {
        
        var res = "";
        switch (exp[0].name) {
            case "dacon":
                res += "[\"" + exp[0].id + "\"";
                for (var i = 1; i < exp.length; i++) {
                    res += ", " + comAexp(exp[i]);
                }
                res += "]"
                break;
            default:
                res += comAexp(exp[0],true);
                for (var i = 1; i < exp.length; i++) {
                    res += "(" + comAexp(exp[i]) + ")";
                }
//                res += ")";
                break;
        }
        return res;
    }
*/

    var comExpCase = function(cas) {
        // does not matter if case gets a strict or lazy value
        var ex_code = comExp(cas.exp)[1];
		assert.ok(typeof ex_code === "string" );
        var res = "";
        res += "new JSHC.Thunk(function(){return ";

//        alert("COMPILED: \n" + JSHC.showAST(cas.exp) + "to:\n" + JSHC.showAST(ex))
        res += "JSHC.Internal.match(" + ex_code + ", [\n";
        for (var i = 0; i < cas.alts.length; i++) {
            var bindStrs = JSHC.comUtils.getBindStrs(cas.alts[i].pat);
            res += "{p: " + comCasePat(cas.alts[i].pat) + ",";
            res += "f: function(" + bindStrs.join(",");
            var rhs_code = comExp(cas.alts[i].exp);
            if( rhs_code[0] ){
                rhs_code = "new JSHC.Thunk(" + rhs_code[1] + ")";
            } else {
                rhs_code = rhs_code[1];
            }
            res += "){return " + rhs_code + "}},\n";
        }
        res += "])";
        res += "})\n";  // end of creation of thunk
        //JSHC.alert("case result\n",cas.exp,"\n\n",ex_code,"\n\n",res);
        return [false,res];
    }

    var comCasePat = function(pat) {

        var res = "";
        switch (pat.name) {
            case "dacon":
                res += "new JSHC.Internal.ConPat(\""+pat.id+"\",[])";
                break;
            case "conpat":
                res += "new JSHC.Internal.ConPat(\""+pat.con.id+"\",[";
                for (var i = 0; i < pat.pats.length; i++) {
                    res += comCasePat(pat.pats[i]) + ", ";
                }
                res += "])"
                break;
            case "tuple_pat":
                res += "new JSHC.Internal.TuplePat(["
                for (var i = 0; i < pat.members.length; i++) {
                    res += comCasePat(pat.members[i]) + ", ";
                }
                res += "])"
                break;
            case "varname":
                res += "new JSHC.Internal.NamePat(\"" + pat.id + "\")";
                break;
            case "integer-lit":
                res += "new JSHC.Internal.IntegerPat("+pat.value+")";
                break;
            case "wildcard":
                res += "new JSHC.Internal.WildPat()";
                break;
            default:
                throw new Error("comCasePat not defined for name " + pat.name);
        }
        return res;
    }

    var comData = function(type){
        if( type.constrs.length == 0 ){
            return "";  // empty datatype, so no code needed
        }
        var buf = [];
        buf.push(modid+"[\":"+type.typ.tycon+"\"] = function(dacon,args){\n");
        buf.push("    assert.ok(typeof dacon == \"string\");\n");
        buf.push("    assert.ok(args instanceof Array);\n");
        buf.push("    this.dacon = dacon;\n");
        buf.push("    this.args = args;\n");
        buf.push("};\n");
        buf.push(modid+"[\":"+type.typ.tycon+"\"].prototype = new JSHC.Internal.Datatype();\n");

        for(var ix=0 ; ix<type.constrs.length ; ix++){
            var dacon = type.constrs[ix].dacon;
            var N = type.constrs[ix].types.length;

            buf.push(modid+"[\""+dacon+"\"] = ");

            for(var jx=0 ; jx<N ; jx++){
                buf.push("function(a"+jx+"){return new JSHC.Thunk(");
            }

            buf.push("new "+modid+"[\":"+type.typ.tycon+"\"](\""+dacon+"\",[");
            if( N > 0 ){
                for(var jx=0 ; jx<N ; jx++){
                    buf.push("a"+jx);
                    buf.push(",");
                }
                buf.pop();   // remove last ",".
            }
            buf.push("])");

            for(var jx=0 ; jx<N ; jx++){
                buf.push(")}");
            }
            buf.push("\n");
        }
        //JSHC.alert("datatype code\n",buf.join(""));
        return buf.join("");
    };

    var comExpTuple = function(tuple){
        var buf = [];
        buf.push("new JSHC.Internal.Types[\"()\"]([");
        for(var ix=0 ; ix<tuple.members.length ; ix++){
            var exp_code = comExp(tuple.members[ix]);
            if( exp_code[0] ){
                // all params of the tuple constructor need to be thunks.
                buf.push("new JSHC.Thunk("+exp_code[1]+")");
            } else {
                buf.push(exp_code[1]);
            }
            buf.push(",");
        }
        buf.pop();
        buf.push("])");
        return [true,buf.join("")];
    };

    /*
       function application expression
    */
    var comExpApp = function(app){
        assert.ok(app.exps.length > 1);

        var buf = [];
        buf.push("new JSHC.Thunk(function(){return ");

        var fun = comExp(app.exps[0]);
        buf.push(fun[1]);

        // if lazy, then evaluate it to get the function to use.
        if( !fun[0] ){
            buf.push(".v");
        }

        for(var ix=1 ; ix<app.exps.length ; ix++){
            var arg = comExp(app.exps[ix]);
            buf.push("(");
            //JSHC.alert("compiling\n",app.exps[ix],"\n",arg);
            if( arg[0] ){
                buf.push("new JSHC.Thunk("+arg[1]+")");
            } else {
                buf.push(arg[1]);
            }
            buf.push(")");
            if( ix+1 < app.exps.length ){
                buf.push(".v");
            }
        }
        buf.push("})");
        return [false,buf.join("")];
    };

    /*
        wrap internal names with params into a curried (lazy) function and then
        add a thunk that evaluates all argument thunks and then calls the strict
        function
        if no params, then just add a thunk.
    */
    var comExpInternal = function(name){
        if( ! (eval(name) instanceof Function) ){
            throw new Error("compilation: missing internal name");
        }

        var types;
        switch( name ){
        case "JSHC.Internal.int32add":
        case "JSHC.Internal.int32sub":
        case "JSHC.Internal.int32mul":
        case "JSHC.Internal.int32div":
        case "JSHC.Internal.int32max":
        case "JSHC.Internal.int32min":
          types = ["Int32","Int32","Int32"];
          break;

        case "JSHC.Internal.int32negate":
        case "JSHC.Internal.int32abs":
        case "JSHC.Internal.int32signum":
          types = ["Int32","Int32"];
          break;

        case "JSHC.Internal.int32eq":
        case "JSHC.Internal.int32lt":
        case "JSHC.Internal.int32gt":
        case "JSHC.Internal.int32le":
        case "JSHC.Internal.int32ge":
        case "JSHC.Internal.int32eq":
        case "JSHC.Internal.int32ne":
          types = ["Int32","Int32","Bool"];
          break;

        case "JSHC.Internal.strLit":
        case "JSHC.Internal.show":
        case "JSHC.Internal.putStr":
        case "JSHC.Internal.putStrLn":
          types = ["any","any"];
          break;
        case "JSHC.Internal.seq":
          types = ["any","any","any"];
          break;

        case "JSHC.Internal.undefined":
          types = ["any"];
          break;

        default:
          throw new Error("missing case for: "+name);
        }

        var N = eval(name+".length");
        assert.ok(typeof N == "number", typeof N);
        assert.ok(N == types.length-1, N + " != " + types.length-1);

        if( N === 0 ){
            // wrap foreign function (with no params) to be evaluated.
            return [false,"new JSHC.Thunk("+name+")"];
        }

        var buf = [];
        for(var ix=0 ; ix<N ; ix++){
            buf.push("function(a"+ix+"){return new JSHC.Thunk(");
        }

        buf.push(name+"(");
        for(var ix=0 ; ix<N ; ix++){

            switch( types[ix] ){
            case "Int32": case "Char": case "any":
              // do nothing, since same representation in Haskell and JavaScript.
              buf.push("a"+ix+".v");
              break;
            case "[Char]":
              buf.push("JSHC.Internal.HSString_to_JSString(a"+ix+")");
              break;
            default:
              throw new Error("missing case");
            }

            buf.push(",");
        }
        buf.pop();   // remove last ",".
        buf.push(")");

        // if the result is a boolean, then create a True/False haskell value.
        switch( types[types.length-1] ){
        case "Bool":
            buf.push(" ? "+namespace+".Prelude.True : "+namespace+".Prelude.False");
            break;
        case "Int32": case "Char": case "any":
            break;
        default:
            throw new Error("missing case");
        }
        //buf.push("}");

        for(var ix=0 ; ix<N ; ix++){
            buf.push(")}");
        }

        //JSHC.alert("comExpInternal\n",buf.join(""));
        //throw new Error("comExpInternal");
        return [true,buf.join("")];
    };

    /*
        read qualified names from the namespace.
        wrap internal names.
    */
    var comExpName = function(exp){
        if( exp.loc === undefined ){
            if( exp.id == "[]" ){
                return [true,"JSHC.Internal.Types[\"[].[]\"]"];
            } else if( exp.id == ":" ){
                return [true,"JSHC.Internal.Types[\"[].:\"]"];
            } else {
                return [false,exp.toString()];
            }
        } else {
//                    var x = exp.id.substr(exp.loc.length);
            //var x = exp.id.substr(exp.id.lastIndexOf(".")+1);
            var x = exp.id;
//                    r = r.substr(0, r.length-1);
            //res += "new JSHC.Thunk(function(){return ";
                    //filter out references to our internal libraries
            if (exp.loc.substr(0,13) === "JSHC.Internal") {
                return comExpInternal(exp.loc + "." + x);
            } else if ( exp instanceof JSHC.DaCon ) {
                return [true,namespace + "." + exp.loc + "[\"" + x + "\"]"];
            } else {
                assert.ok( x.length !== 0 );
                return [false,namespace + "." + exp.loc + "[\"" + x + "\"]"];
            }
        }
    };

    var comExpDecls = function(exp) {
    	var res = "";
    	res += " (function() {\n"
    	for (var i = 0; i < exp.decls.length; i++) {
    		res += comLocalDecl(exp.decls[i]);
    	}
    	res += "return " + comExp(exp.exp)[1] + ";}())";
    	return [false, res];	
    };
    
    var comLocalDecl = function(decl) {
        var res = "";
        switch (decl.name) {
            case "decl-fun":
                res = "var " + (decl.ident.toString() + " = " + comRhs(decl.rhs)) + ";\n";
                break;
            default:
                throw new Error("comLocalDecl not defined for name " + decl.name);
        }

        if( typeof res != "string" ){
            JSHC.alert("compiling\n",decl);
            JSHC.alert("to\n",res);
            throw new Error("stop");
        }

        return res;
    }

    var comExpLambda = function(lamb,atArg){
        if (atArg === undefined) {
            assert.ok( lamb.args.length > 0 );
            atArg = 0;
        }
        var res = "";
        if (atArg < lamb.args.length) {
            var arg = lamb.args[atArg];
            res += "function(" + comApat(arg) + "){ return "

            atArg++;
            var code = comExpLambda(lamb,atArg);
            if( code[0] ){
                res += "new JSHC.Thunk(" + code[1] + ")";
            } else {
                res += code[1];
            }

            res += "}";
            return [true,res];
        } else {
            return comExp(lamb.rhs);
        }
    };

    var comExpLit = function(exp){
        assert.ok( exp.name == "integer-lit" );
        //return "new JSHC.Thunk("+exp.value+")";
        return [true,""+exp.value];
    };

    if (input.name === "application" ||
        input.name === "varname" || input.name === "dacon" ||
        input.name === "integer-lit" || input.name === "case" ||
        input.name === "lambda" || input.name === "let")
        return comSoloExp(input);
    else
        return comModule(input);
    
}


// --- src/Load/load.js ---

// requires assertions

if( JSHC.Load === undefined )JSHC.Load = {};

////////////////////////////////////////////////////////////////////////////////

JSHC.Load.syncLoadURL = function(url, params){
    var req = new XMLHttpRequest();
    req.open("GET", url, false); // waits until operation is complete.

    req.overrideMimeType('text/plain; charset=utf-8');
    params.forEach(function(param){
	req.setRequestHeader(param.header, param.value);
    });

    req.send(null);

    assert.ok( req.readyState === 4, "ready state must be 4 after loading synchronuously" );

    return req;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Load.asyncLoadURL = function(h0, url, params){
    var req = new XMLHttpRequest();
    req.open("GET", url, true);

    req.overrideMimeType('text/plain; charset=utf-8');
    params.forEach(function(param){
	req.setRequestHeader(param.header, param.value);
    });
    req.onreadystatechange = function() {

	// wait until operation is complete.
	if( req.readyState !== 4 )return;
	    
	h0(url, req);
    };

    req.send(null);
    return req;
};

////////////////////////////////////////////////////////////////////////////////

/*
  Returns a JSHC.Load.Module.
 */
JSHC.Load.syncLoadName = function(fileSystem, urls, prev){
    var modName;
    var i;

    if( prev instanceof JSHC.Load.Module ){
	modName = prev.name;
    } else if( typeof prev === "string" ){
	modName = prev;
	prev = JSHC.Load.Module.unread(modName);
    } else {
	throw new Error("invalid parameter");
    }

    var fileName = modName.replace(/\./g, "/") + ".hs";

    // try to find the module name in the file system
    if( fileSystem[modName] !== undefined ){
	if( prev.contents == fileSystem[modName] ){
	    return prev;
	} else {
	    return JSHC.Load.Module.done({
		name: modName,
		contents: fileSystem[modName],
		source: modName,
		date: null});
	}
    }

    // iterate over the search path with URL prefixes.
    for(i=0;i<urls.length;i++){
	var prefix = urls[i];
	var url = prefix + fileName;

	var params = [];
	if( prev.source === url ){
	    params.push({header: "If-Modified-Since", value: prev.date});
	}

	try{
	    var req = JSHC.Load.syncLoadURL(url, params);
	} catch( err ){
	    //this.onWarning("Could not initiate request: "+err);
	    continue; // try next source
	}

	// make sure the date is either 'null' or a non-0 length string.
	var date = req.getResponseHeader("Last-Modified");
	if( date === undefined ||
	    !(typeof date === "string") ||
	    date.length == 0 ){
	    date = null;
	}

	// check if using FILE protocol
	if( prefix.substring(0,7) === "file://" ){
	    if( prev.contents == req.responseText ){
	        return prev;
	    } else {
	        return JSHC.Load.Module.done({
		    name: modName,
		    contents: req.responseText,
		    source: url,
		    date: date});
	    }
	}

	// handling HTTP response
	switch( req.status ){
	case 200: // ok
	return JSHC.Load.Module.done({
		name: modName,
		contents: req.responseText,
		source: url,
		date: date});

	case 204: // no response
	this.onWarning("No response when trying to read "+url);
	continue; // try next source
	
	case 304: // not modified
	assert.ok( prev.status === "success" || prev.status === "failure", "HTML response of not modified must mean that the module has previously been found" );
	return prev;

	case 404: // not found
	this.onWarning("Module not found in any buffer or any of the "+
		       "URL search paths.");
	continue; // try next source

	default:
	this.onWarning("Unknown response from "+url+
		       ", got status="+req.status);
	continue; // try next source
	}
    }

    // since loop ended, the module was not found at any URL, so fail.
    return JSHC.Load.Module.missing(modName, "Module not found at any of the URLs.");
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Load.asyncLoadName = null; // TODO

////////////////////////////////////////////////////////////////////////////////

JSHC.Load.syncLoadNames = function(fileSystem, urls, rootNames, current){
    assert.ok( rootNames instanceof Array && rootNames.length > 0, "roots must be a non-zero length array" );
    var remaining, loaded;

    loaded = {};
    remaining = [];

    rootNames.forEach(function(root){
	remaining.push(root);
    });

    // load modules
    while( remaining.length > 0 ){
	var name = remaining.pop();

	// skip if already loaded
	if( loaded[name] !== undefined ){
	    continue;
	}

	var mod;
	if( current !== undefined && current[name] !== undefined ){
	    mod = current[name];
	} else {
	    mod = new JSHC.Load.Module.unread(name);
	}

	// reload the module and get a new one
	mod = this.syncLoadName(fileSystem, urls, mod);
	assert.ok( mod instanceof JSHC.Load.Module, "must get a module from syncLoadName" );

	loaded[name] = mod;

	if( mod.status === "success" ){
	    mod.deps(function(d){remaining.push(d);});
	}
    }
    return loaded;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Load.asyncLoadNames = null; // TODO

////////////////////////////////////////////////////////////////////////////////


// --- src/Load/Module.js ---

// requires assertions

if( JSHC.Load === undefined )JSHC.Load = {};

////////////////////////////////////////////////////////////////////////////////

/*
  Module objects must never be changed. considered immutable.

  status = "success"/"failure"/"missing"/"unread"

  if status is unread:
    name : string

  if status is missing:
    name : string
    err : string

  if status is failure:
    name : string
    contents : string
    source : string
    date : string
    err : ParseError

  if status is success:
    name : string
    contents : string
    source : string
    date : string
    ast : AST

  description of common fields:
    name: module name
    contents: file contents
    source: source of contents. URL or the module name (iff local).
    date: date string when last modified, or null if unknown.
*/

JSHC.Load.Module = function(){
    assert.ok( arguments.length === 0 );
};

/*
  Get module dependencies.
  Returns an Array of module names (strings).
 */
JSHC.Load.Module.prototype.deps = function(handler){
    assert.ok( this.status === "success" );

    var is;
    var impdecls = this.ast.body.impdecls;
    if( handler instanceof Function ){
	impdecls.forEach(function(impdecl){
	    handler(impdecl.modid.id);
	});
	return undefined;
    } else {
	is = [];
	impdecls.forEach(function(impdecl){
	    is.push(impdecl.modid.id);
	});
	return is;
    }
};

JSHC.Load.Module.done = function(name, contents, source, date){
    var m = new JSHC.Load.Module();

    if( typeof name === "string" ){
	m.name = name;
	m.contents = contents;
	m.source = source;
	m.date = date;
    } else {
	var obj = name;
	m.name = obj.name;
	m.contents = obj.contents;
	m.source = obj.source;
	m.date = obj.date;
    }

    // TODO:
    // compute flags by reading the first line or something from the file.
    m.flags = [];

    try {
	m.ast = JSHC.parse(m.contents);
    } catch(err){
	if( err instanceof JSHC.ParseError ){
	    m.status = "failure";
	    m.err = err;
	    return m;
	} else {
	    throw err;
	}
    }

    if( m.name !== m.ast.modid.id ){
        m.status = "failure";
        m.err = "module name \""+m.ast.modid.id+"\" does not match file name \""+m.name+"\"";
        return m;
    }

    m.status = "success";
    return m;
};

JSHC.Load.Module.missing = function(name, err){
    var m = new JSHC.Load.Module();
    m.status = "missing";
    m.name = name;
    m.err = err;
    return m;
};

JSHC.Load.Module.unread = function(name){
    assert.ok( typeof name == "string" );
    var m = new JSHC.Load.Module();
    m.status = "unread";
    m.name = name;
    return m;
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Compiler/Compiler.js ---

if( ! JSHC.Compiler )JSHC.Compiler = {};

////////////////////////////////////////////////////////////////////////////////

JSHC.Compiler = function(modulePrefix){
    this.flags = {};
    this.fileSystem = {};
    this.path = JSHC.Compiler.getDefaultPath();
    this.modulePrefix = modulePrefix;
    this.modules = {};   // mapping from module names to modules

    this.syncLoadNames = JSHC.Load.syncLoadNames;
    this.syncLoadName = JSHC.Load.syncLoadName;

    this.syncLoad = function(names){
	return this.syncLoadNames(this.fileSystem, this.path, names, this.modules);
    };

    this.errors = 0;
    this.warnings = 0;
    this.messages = 0;
    this.errorList = [];
    this.warningList = [];
    this.messageList = [];

    this.errorHandlers = [];
    this.warningHandlers = [];
    this.messageHandlers = [];
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Compiler.getDefaultPath = function(){
    var path = [];
    if( location !== undefined && location.href !== undefined ){
        path.push(location.href.substr(0, location.href.lastIndexOf("/") + 1) + "hslib/");
        path.push(location.href.substr(0, location.href.lastIndexOf("/") + 1) + "hsusr/");
    }
    return path;
};

JSHC.Compiler.prototype.setTargets = function(targets){
    assert.ok( targets instanceof Array );
    if( targets.length === 0 ){
	this.targets = ["Prelude"];
    } else {
	this.targets = targets;
    }
};

JSHC.Compiler.prototype.getTargets = function(){
    return this.targets;
};

JSHC.Compiler.prototype.setFileSystem = function(fileSystem){
    assert.ok( fileSystem !== undefined );
    this.fileSystem = fileSystem;
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Compiler.prototype.onError = function(err){
    this.errors++;

    if( this.errorHandlers.length == 0 ){
        this.errorList.push(err);
    } else {
        for(var i=0 ; i<this.errorHandlers.length ; i++){
            this.errorHandlers[i](err);
        }
    }
};

JSHC.Compiler.prototype.onWarning = function(warn){
    this.warnings++;

    if( this.warningHandlers.length == 0 ){
        this.warningList.push(warn);
    } else {
        for(var i=0 ; i<this.warningHandlers.length ; i++){
            this.warningHandlers[i](warn);
        }
    }
};

JSHC.Compiler.prototype.onMessage = function(msg){
    this.messages++;

    if( this.messageHandlers.length == 0 ){
        this.messageList.push(msg);
    } else {
        for(var i=0 ; i<this.messageHandlers.length ; i++){
            this.messageHandlers[i](msg);
        }
    }
};

JSHC.Compiler.prototype.addErrorHandler = function(onError){
    this.errorHandlers.push(onError);
};

JSHC.Compiler.prototype.addWarningHandler = function(onWarning){
    this.warningHandlers.push(onWarning);
};

JSHC.Compiler.prototype.addMessageHandler = function(onMessage){
    this.messageHandlers.push(onMessage);
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Compiler.prototype.recompile = function(){
    var mods;
    var entries = [];
    var mod,k;
    var names = this.targets;
    var errs = [];

    // load files
    mods = this.syncLoad(names);

    // start with empty set of checked modules
    var prev_modules = this.modules;
    this.modules = {};

    this.errors = 0;   // clear old errors
    this.warnings = 0;
    this.messages = 0;
    this.errorList = [];
    this.warningList = [];
    this.messageList = [];

    for(k in mods){ // mods : map
	mod = mods[k];
	if( mod.status === "success" ){
	    // produce an entry for the dependency graph
	    entries.push(new JSHC.Dep.Entry([mod],[mod.ast.modid.id],mod.deps()));
	} else if( mod.status === "failure" ){
	    this.onError("Failed to parse "+mod.name+": "+mod.err);
	} else if( mod.status === "missing" ){
	    this.onError("Failed to find "+mod.name+": "+mod.err);
	} else {
	    this.onError("Internal error: "+mod.name+": "+mod.err);
	}
    }

    // stop if there were parse errors
    if( this.errors > 0 ){
        return;
    }

    // traverse the graph in dependency order, and for each module group:
    var compiler = this;
    var module_group_action = function(group){
        // stop if there were errors in a previous group
        if( compiler.errors > 0 ){
            return;
        }

        // re-check all modules if not all have already been compiled
        var all_compiled = true;
        for(var ix=0 ; ix<group.values.length ; ix++){
            var mod = group.values[ix];
            if( prev_modules[mod.ast.modid.id] !== mod ){
                all_compiled = false;
            }
        }

        // check if already done
        if( all_compiled ){
            for(var ix=0 ; ix<group.values.length ; ix++){
                var mod = group.values[ix];
                compiler.modules[mod.ast.modid] = mod;
            }
            return;
        }

        // re-parse the modules that have not changed, so that they can be
        // checked again, but together with the new or modified modules.
        for(var ix=0 ; ix<group.values.length ; ix++){
            var mod = group.values[ix];
            if( prev_modules[mod.ast.modid.id] === mod ){
                // re-parse to get new AST
                group.values[ix] = JSHC.Load.Module.done(
                    mod.name, mod.contents, mod.source, mod.date);
                mod = group.values[ix];
            }

            // compute/check top-level namespace and add it to AST body.
            assert.ok( mod.checked !== true );
            JSHC.addToplevelNamespace(compiler, mod.ast);
        }

        compiler.onMessage("checking group "+group);

        // export check hack to solve cycles
        for (var i = 0; i < group.values.length; i++) {
            var ast = group.values[i].ast;

            // no export specification, so export all top-level declarations
            if( ast.exports === undefined ){
                ast.espace = {};  // new empty namespace for all exports
                for(var name in ast.body.tspace){
                    ast.espace[name] = ast.body.tspace[name];
                }
                compiler.modules[ast.modid] = group.values[i];
            }
        }

        // run name check on each module
        for (var i = 0; i < group.values.length; i++) {
            var module = group.values[i];

            compiler.onMessage("checking "+module.ast.modid);
            JSHC.Check.nameCheck(compiler, module.ast);
        }

        if( compiler.errors > 0 ){
            return;
        }

        // run fixity resolution on each module
        for (var i = 0; i < group.values.length; i++) {
            var module = group.values[i];

            JSHC.Fixity.fixityResolution(module.ast);
        }

        if( compiler.errors > 0 ){
            return;
        }

        // type check: add types and kinds to top-level declarations
        var asts = [];
        group.values.forEach(function(mod){asts.push(mod.ast);});
        JSHC.Check.typeCheck(compiler,asts);

        // add all the modules in the group to the set of checked modules
        for (var i = 0; i < group.values.length; i++) {
            var m = group.values[i];
            compiler.modules[m.name] = m;
            m.checked = true;
        }
    };

    JSHC.Dep.check(entries,module_group_action);

    // skip code generation if errors have occured
    if( this.errors > 0 ){
        return;
    }

    // for each graph entry in arbitrary order, simplify and generate code.
    for(k in this.modules) {
        JSHC.Simplify.runSimplify(this.modules[k].ast);
    	this.modules[k].jscode = JSHC.Codegen.codegen(this.modules[k].ast, this.modulePrefix);
    }

//    alert("GENERATED CODE: \n\n" + this.getAllJSCode())

    eval("delete "+this.modulePrefix);
    eval(this.modulePrefix+" = {};");
    eval(this.getAllJSCode());
};

JSHC.Compiler.prototype.checkExp = function (exp){

    this.errors = 0;   // clear old errors
    this.errorList = [];

    var res = JSHC.parseExp(exp);
//    JSHC.alert("Parsed expr: ", res)
    res = {name: "decl-fun",
           ident: new JSHC.VarName("Interact+",undefined,false),
           args: [],
           rhs: res};
    res = {name: "topdecl-decl", decl: res};

    var impdecls = [];
    for(var modname in this.modules ){
        impdecls.push({name: "impdecl", modid: this.modules[modname].ast.modid});
    }

    res = {name: "body", impdecls: impdecls, topdecls: [res]};

    res = {name: "module", modid: {name: "modname", id: "interact+"}, body: res};
    
    JSHC.addToplevelNamespace(this,res);
    JSHC.Check.nameCheck(this,res);      if( this.errors > 0 ){ return; }
    JSHC.Fixity.fixityResolution(res);   if( this.errors > 0 ){ return; }
    JSHC.Check.typeCheck(this,[res]);    if( this.errors > 0 ){ return; }
    JSHC.Simplify.runSimplify(res);
    return res.body.topdecls[0].decl;
};

JSHC.Compiler.compileExp = function (exp,prefix,fileSystem){
    var compiler = new JSHC.Compiler(prefix);
    
    if (fileSystem !== undefined)
        compiler.setFileSystem(fileSystem);
    
    var decl = compiler.checkExp(exp);
    return JSHC.Codegen.codegen(decl.rhs, prefix);
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Compiler.prototype.getAllJSCode = function(){
    var code = [];
    var m;

    for(m in this.modules) {
	code.push(this.modules[m].jscode);
    }

    return code.join("\n");
};

////////////////////////////////////////////////////////////////////////////////


// --- src/Compiler/Interpreter.js ---

////////////////////////////////////////////////////////////////////////////////

// Interpreter
JSHC.Interpreter = function(modulePrefix){
    assert.ok( modulePrefix !== undefined );
    this.history = [];    // command history
    this.compiler = new JSHC.Compiler(modulePrefix);

    // make compiler messages be added to the interpreter messages
    var interpreter = this;
    var errorHandler = function(err){
        interpreter.onError(err);
    };
    var warningHandler = function(warn){
        interpreter.onWarning(warn);
    };
    var messageHandler = function(msg){
        interpreter.onMessage(msg);
    };
    this.compiler.addErrorHandler(errorHandler);
    this.compiler.addWarningHandler(warningHandler);
    this.compiler.addMessageHandler(messageHandler);

    this.prefix = modulePrefix;

    this.resetStatus();

    this.errorHandlers = [];
    this.warningHandlers = [];
    this.messageHandlers = [];
};

JSHC.Interpreter.commands =
  [":help", ":kind", ":load", ":show", ":type", ":js",
   ":show path", ":show code", ":show modules"];

////////////////////////////////////////////////////////////////////////////////

JSHC.Interpreter.prototype.resetStatus = function(){
    this.errors = 0;
    this.warnings = 0;
    this.messages = 0;
    this.errorList = [];
    this.warningList = [];
    this.messageList = [];
};

JSHC.Interpreter.prototype.execCommand = function(line){
    var command;
    line = line.trim();
    var words = line.split(/\s/);

    if( words[0][0] === ":" ){
	command = words[0];
    } else {
	command = "";
    }

    // clear old messages
    this.resetStatus();

    switch( command ){
    case ":":
	// repeat previous command

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":add":
	// add modules to target set

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":browse":
	// :browse [[*]modulename]
	// show espace of module. default to last loaded module.
	// '*'  show all names in top-level scope of module.
	//      i.e union up all ispaces and the tspace, then resolve each
	//      name so that it will be qualified if ambiguous, otherwise not.

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":edit":
	// :edit modulename/URL
	// open a module (creates new buffer) from the file system or URL

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":help": case ":?":
	this.onMessage(JSHC.Interpreter.commands.join("\n"));
	break;

    case ":info":
	// :info name     // give location of any name. members of tycon/tycls.
	//    tab-completion on names.

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":kind":
        // :kind name     // must be a type constructor
        for(var w=1 ; w<words.length ; w++ ){
            this.commandKind(words[w]);
        }
	break;

    case ":load":
        // :load modulename+   // specify new targets. reloads.
	//     default to a subset or the prelude in case of failure.
	//     sets the view set to the same as the target set.
	// :load              // target and view will be the prelude.

        this.compiler.setTargets(words.slice(1));
        //this.view = this.compiler.getTargets(); // get copy of targets
        try {
            this.compiler.recompile();
        } catch (err) {
            JSHC.alert("Compiler exception:\n",JSHC.showError(err));
        }
        break;

    case ":module":
	// :module [+/-] ([*]modulename)+    // modify the view set
	//   '*'      access to tspace + ispaces.
	//   non-'*'  access to espace.

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":quit":
	// :quit     // remove buffer (and frame if >1) "kill_frame" ?

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":reload":
	// :reload   // reload the targets. get a new set of loaded modules.

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":set":
	// :set       // set an interpreter variable

	this.onError("\""+words[0]+"\" not implemented");
	break;

    case ":show":
	// :show
	//     bindings   // show bindings by interpreter let-statements
	//     modules    // show loaded modules
	//     path       // show URLs
	//     files      // show files in file system
	//     code       // show generated code of all loaded modules
	//                // should have a command to open code in a buffer ?

	if( words.length !== 2 ){
	    this.onMessage(":show path\n:show code\n:show modules");
	    break;
	}
	switch( words[1] ){
	case "path":
	    this.onMessage(this.compiler.path.join("\n"));
	    break;
	case "code":
	    this.onMessage(this.compiler.getAllJSCode());
	    break;
	case "modules":
	    for(var loaded_module in this.compiler.modules){
	        this.onMessage(loaded_module);
	    }
	    break;
	default:
	    this.onError("invalid interpreter variable");
	}
	break;

    case ":type":
	// :type          // parse and type expression. then show type.
	var expression = line.substr(words[0].length+1);
	var decl = this.compiler.checkExp(expression);
	if( this.errors === 0 ){
            if( decl.ident.type === undefined ){
                this.onError("type is missing");
            } else {
                this.onMessage(decl.ident.type.toString());
            }
        }
	break;

    case ":!":
    case ":js":
        try {
            this.onMessage(eval(line.substr(3)));
        } catch (err) {
            this.onError(err);
        }
        break;
    
    case "":
	// evaluation of expressions
	// * names
	//   need to have access to all the names in top-level scope of all
	//   target modules. should perhaps give the name resolution function a
	//   set of modules in scope instead of working on one so that one can
	//   pass in a list of them and it will check the tspace and ispaces of
	//   all of them.
	// * compilation
	//   each expression must be compiled. let-statements makes
	//   declarations. for any non-let-statement, do "let it = e; print it"
	//   as in GHCi.

	// * import modulename
	//   equivalent to ":module +modulename"
        try {
            if( line.length === 0 ){
                break;
            }

            var decl = this.compiler.checkExp(line);
            if( this.errors !== 0 ){
                break;
            }

            var expr = JSHC.Codegen.codegen(decl.rhs, this.prefix);
            var result = eval(expr);
            if( result === undefined ){
                throw new JSHC.RuntimeError("bad result: undefined result for: "+expr);
            }
            var show_result = result.toString();
            if( show_result === undefined ){
                throw new JSHC.RuntimeError("bad result: undefined string for: "+JSHC.showAST(result));
            }
            this.onMessage(show_result);

        } catch (err) {
            if (err instanceof JSHC.RuntimeError) {
                this.onError(err.toString());
            } else {
                alert("expression:\n" + line + "\ngenerated code:\n" + expr + "\nwith error:\n\n" + JSHC.showError(err));
                this.onError(err);
            }
        }
	break;

    default: this.onError("unknown command: "+command);
    }
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Interpreter.prototype.autoComplete = function(partial_command){
    var results = [];
    for(var ix=0 ; ix<JSHC.Interpreter.commands.length ; ix++){
        var cmd = JSHC.Interpreter.commands[ix];
        if( cmd.substr(0,partial_command.length) == partial_command ){
            results.push(cmd);
        }
    }

    if( results.length === 0 ){
        return {error: "auto-completion: no match"};
    } else if( results.length === 1 ){
        return {line: results[0].substr(partial_command.length)};
    } else {
        return {matches: results};
    }
};

////////////////////////////////////////////////////////////////////////////////

JSHC.Interpreter.prototype.onError = function(err){
    this.errors++;

    if( this.errorHandlers.length == 0 ){
        this.errorList.push(err);
    } else {
        for(var i=0 ; i<this.errorHandlers.length ; i++){
            this.errorHandlers[i](err);
        }
    }
};

JSHC.Interpreter.prototype.onWarning = function(warn){
    this.warnings++;

    if( this.warningHandlers.length == 0 ){
        this.warningList.push(warn);
    } else {
        for(var i=0 ; i<this.warningHandlers.length ; i++){
            this.warningHandlers[i](warn);
        }
    }
};

JSHC.Interpreter.prototype.onMessage = function(msg){
    this.messages++;

    if( this.messageHandlers.length == 0 ){
        this.messageList.push(msg);
    } else {
        for(var i=0 ; i<this.messageHandlers.length ; i++){
            this.messageHandlers[i](msg);
        }
    }
};

JSHC.Interpreter.prototype.addErrorHandler = function(onError){
    this.errorHandlers.push(onError);
};

JSHC.Interpreter.prototype.addWarningHandler = function(onWarning){
    this.warningHandlers.push(onWarning);
};

JSHC.Interpreter.prototype.addMessageHandler = function(onMessage){
    this.messageHandlers.push(onMessage);
};

////////////////////////////////////////////////////////////////////////////////
// functions to handle commands

JSHC.Interpreter.prototype.commandKind = function(qname){

    var ast = this.lookupName(qname);
    if( ast !== undefined ){
        if( ast.kind === undefined ){
            this.onError("kind is missing for \""+ast+"\"");
        } else {
            this.onMessage(ast.kind.toString());
        }
    }
};

JSHC.Interpreter.prototype.commandType = function(qname){

    var ast = this.lookupName(qname);
    if( ast !== undefined ){
        if( ast.type === undefined ){
            this.onError("type is missing for \""+ast+"\"");
        } else {
            this.onMessage(ast.type.toString());
        }
    }
};

////////////////////////////////////////////////////////////////////////////////

/*
  takes a name that may be qualified and resolves it.
  if qualified, it will be searched for in the exports of that module.
  if unqualified, it will be searched for among the target modules.
  
  if not found, an error is added and 'undefined' is returned.
*/
JSHC.Interpreter.prototype.lookupName = function(qname){
    var dotix = qname.lastIndexOf(".");
    var name;

    if( dotix === -1 ){
       name = qname;  // not qualified
       var asts = [];
       //var roots = this.compiler.getTargets();
       for(var mod in this.compiler.modules){
       //for(var ix=0 ; ix<roots.length ; ix++){
           var ast = this.compiler.modules[mod].ast.espace[name];
           //var ast = this.compiler.modules[roots[ix]].ast.espace[name];
           if( ast === undefined )continue;
           asts.push(ast);
       }
       switch( asts.length ){
       case 0:
           this.onError("\""+qname+"\" not in scope");
           break;
       case 1:
           return asts[0];
           break;
       default:
           var msg = ["\""+qname+"\" is ambiguous, and may refer to "];
           for(var ix=0 ; ix<asts.length ; ix++){
               msg.push(asts[ix].toStringQ());
               msg.push(", ");
           }
           msg.pop();
           this.onError(msg.join(""));
       }
    } else {
        var name = qname.substr(dotix+1);
        var loc = qname.substr(0,dotix);
        var module = this.compiler.modules[loc];
        if( module === undefined ){
           this.onError("module "+loc+" is not loaded");
        } else {
            var ast = module.ast.espace[name];
            if( ast === undefined ){
               this.onError(loc+" does not export "+name);
            } else {
                return ast;
            }
        }
    }
};

////////////////////////////////////////////////////////////////////////////////


// --- JSHC Runtime Extensions ---
(function(){
  JSHC.Internal.__strs = [];
  JSHC.Internal.__stdout = "";
  function forceAll(v) {
    while (v instanceof JSHC.Thunk) v = v.v;
    return v;
  }
  function listToJsString(v) {
    var chars = [];
    v = forceAll(v);
    while (v && v.dacon === ":") {
      var ch = forceAll(v.args[0]);
      chars.push(typeof ch === "string" ? ch : String(ch));
      v = forceAll(v.args[1]);
    }
    return chars.join("");
  }
  function jsStringToList(s) {
    var acc = JSHC.Internal.Types["[].[]"];
    for (var i = s.length - 1; i >= 0; i--) {
      var ch = new JSHC.Thunk(s[i]);
      var tail = new JSHC.Thunk(acc);
      acc = new JSHC.Internal.Types["[]"](":", [ch, tail]);
    }
    return acc;
  }
  function showValue(v) {
    v = forceAll(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      if (v.dacon === "[]") return "[]";
      if (v.dacon === ":") {
        var first = forceAll(v.args[0]);
        if (typeof first === "string" && first.length === 1) return listToJsString(v);
        var parts = [];
        var cur = v;
        while (cur && cur.dacon === ":") {
          parts.push(showValue(cur.args[0]));
          cur = forceAll(cur.args[1]);
        }
        return "[" + parts.join(",") + "]";
      }
      if (v.dacon === "IO" && v.args && v.args.length) {
        return showValue(v.args[0]);
      }
      if (v instanceof JSHC.Internal.Types["()"]) {
        if (!v.args.length) return "()";
        return "(" + v.args.map(showValue).join(",") + ")";
      }
      if (typeof v.toString === "function") return v.toString();
    }
    return String(v);
  }
  JSHC.Internal.strLit = function(idx) {
    idx = forceAll(idx);
    return jsStringToList(JSHC.Internal.__strs[idx] || "");
  };
  JSHC.Internal.show = function(x) {
    return jsStringToList(showValue(x));
  };
  JSHC.Internal.putStr = function(s) {
    JSHC.Internal.__stdout += listToJsString(s);
    return new JSHC.Internal.Types["()"]([]);
  };
  JSHC.Internal.putStrLn = function(s) {
    JSHC.Internal.__stdout += listToJsString(s) + "\n";
    return new JSHC.Internal.Types["()"]([]);
  };
  JSHC.hslib = {"Control.Monad":"\n{-\nsee Chapter 13 of the Haskell 2010 Language Report\n-}\n\nmodule Control.Monad where\n\nimport System.IO\nimport Data.Maybe\nimport Data.Array\n","Data.Array":"\n{-\nsee Chapter 14 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Array (\n  module Data.Ix,  -- re-export everything from Data.Ix\n ) where\n\nimport Data.Ix\n","Data.Bits":"\n{-\nsee Chapter 15 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Bits where\n\n","Data.Char":"\n{-\nsee Chapter 16 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Char where\n\ndata Char\n","Data.Complex":"\n{-\nsee Chapter 17 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Complex where\n\n","Data.Int":"\n{-\nsee Chapter 18 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Int where\n\ndata Int32\n\n{-\ninstance Ord Int32 where\n  compare = JSHC.Internal.int32cmp\n  (<) = JSHC.Internal.int32lt\n  (>=) = JSHC.Internal.int32ge\n  (>) = JSHC.Internal.int32gt\n  (<=) = JSHC.Internal.int32le\n  max = JSHC.Internal.int32max\n  min = JSHC.Internal.int32min\n-}\n","Data.Ix":"\n{-\nsee Chapter 19 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Ix where\n","Data.List":"\n{-\nsee Chapter 20 of the Haskell 2010 Language Report\n-}\n\nmodule Data.List where\n\n","Data.Maybe":"\n{-\nsee Chapter 21 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Maybe where\n\n","Data.Ratio":"\n{-\nsee Chapter 22 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Ratio where\n\n","Data.Word":"\n{-\nsee Chapter 23 of the Haskell 2010 Language Report\n-}\n\nmodule Data.Word where\n\n","Foreign.ForeignPtr":"\n{-\nsee Chapter 29 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.ForeignPtr where\n\n","Foreign.Marshal.Alloc":"\n{-\nsee Chapter 31 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Marshal.Alloc where\n\n","Foreign.Marshal.Array":"\n{-\nsee Chapter 32 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Marshal.Array where\n\n","Foreign.Marshal.Error":"\n{-\nsee Chapter 33 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Marshal.Error where\n\n","Foreign.Marshal.Utils":"\n{-\nsee Chapter 34 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Marshal.Utils where\n\n","Foreign.Marshal":"\n{-\nsee Chapter 30 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Marshal where\n\n","Foreign.Ptr":"\n{-\nsee Chapter 35 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Ptr where\n\n","Foreign.StablePtr":"\n{-\nsee Chapter 36 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.StablePtr where\n\n","Foreign.Storable":"\n{-\nsee Chapter 37 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign.Storable where\n\n","Foreign":"\n{-\nsee Chapter 24 of the Haskell 2010 Language Report\n-}\n\nmodule Foreign where\n\n","Numeric":"\n{-\nsee Chapter 38 of the Haskell 2010 Language Report\n-}\n\nmodule Numeric where\n\n","Prelude":"\nmodule Prelude where\n\nimport Data.Int\n--import Data.Char\n\n--------------------------------------------------------------------------------\n-- booleans\n\ndata Bool = True | False\n -- deriving (Eq, Ord, Enum, Read, Show, Bounded)\n\n(&&), (||) :: Bool -> Bool -> Bool\ninfixr 3 &&\ninfixr 2 ||\nTrue  && x =  x\nFalse && x =  False\nTrue  || x =  True\nFalse || x =  x\n\nnot :: Bool -> Bool\nnot True  = False\nnot False = True\n\notherwise :: Bool\notherwise = True\n\n--------------------------------------------------------------------------------\n\nundefined = JSHC.Internal.undefined\n\n--------------------------------------------------------------------------------\n\ndata Maybe a = Nothing | Just a\n -- deriving (Eq, Ord, Read, Show)\n\ndata Either a b = Left a | Right b\n -- deriving (Eq, Ord, Read, Show)\n\n--------------------------------------------------------------------------------\n-- arithmetic operators\n\ninfixl 7 *, /\ninfixl 6 +, -\n(+) = JSHC.Internal.int32add\n(-) = JSHC.Internal.int32sub\n(*) = JSHC.Internal.int32mul\n(/) = JSHC.Internal.int32div\n\n-- arithmetic comparisons\ninfix 4 < , > , <= , >= , == , /=\n(<)  = JSHC.Internal.int32lt\n(>)  = JSHC.Internal.int32gt\n(<=) = JSHC.Internal.int32le\n(>=) = JSHC.Internal.int32ge\n(==) = JSHC.Internal.int32eq\n(/=) = JSHC.Internal.int32ne\n\nmax = JSHC.Internal.int32max\nmin = JSHC.Internal.int32min\n\n--------------------------------------------------------------------------------\n-- functions\n\nid :: a -> a\nid x = x\n\nconst :: a -> b -> a\nconst x _ = x\n\ninfixr 9 .\n(.) :: (b -> c) -> (a -> b) -> a -> c\nf . g = \\ x -> f (g x)\n\n-- flip :: (a -> b -> c) -> b -> a -> c\nflip f x y = f y x\n\n-- seq :: a -> b -> b\nseq = JSHC.Internal.seq\n\ninfixr 0 $, $!, `seq`\n($), ($!) :: (a -> b) -> a -> b\nf $ x     = f x\nf $! x    = x `seq` f x\n\n--------------------------------------------------------------------------------\n-- list functions\n\n--map :: (a -> b) -> [a] -> [b]\nmap f []         = []\nmap f ((:) x xs) = f x : map f xs\n\ninfixr 5 ++\n--(++) :: [a] -> [a] -> [a]\n[]         ++ ys = ys\n((:) x xs) ++ ys = x : (xs ++ ys)\n\n--filter :: (a -> Bool) -> [a] -> [a]\nfilter p []     = []\nfilter p ((:) x xs) =\n  if p x\n    then x : filter p xs\n    else filter p xs\n\n--concat :: [[a]] -> [a]\nconcat xss = foldr (++) [] xss\n\n--concatMap :: (a -> [b]) -> [a] -> [b]\nconcatMap f = concat . map f\n\n--head       :: [a] -> a\nhead ((:) x _) = x\nhead []        = undefined -- error \"Prelude.head: empty list\"\n\n--tail        :: [a] -> [a]\ntail ((:) _ xs) = xs\ntail []         = undefined -- error \"Prelude.tail: empty list\"\n\n--last        :: [a] -> a\n--last ((:) x []) = x\n--last ((:) _ xs) = last xs\n--last []         = undefined -- error \"Prelude.last: empty list\"\n\n--init        :: [a] -> [a]\n--init [x]    =  []\n--init (x:xs) =  x : init xs\n--init []     =  error \"Prelude.init: empty list\"\n\n--null        :: [a] -> Bool\nnull []         = True\nnull ((:) _ _)  = False\n\n-- length returns the length of a finite list as an Int.\n--length           :: [a] -> Int\nlength []        = 0\nlength ((:) _ l) = 1 + length l\n\n-- List index (subscript) operator, 0-origin\n--(!!)                :: [a] -> Int -> a\n--xs     !! n | n < 0 = error \"Prelude.!!: negative index\"\n--[]     !! _         = error \"Prelude.!!: index too large\"\n--(x:_) !! 0          = x\n--(_:xs) !! n         = xs !! (n-1)\n\n--foldl            :: (a -> b -> a) -> a -> [b] -> a\nfoldl f z []         = z\nfoldl f z ((:) x xs) = foldl f (f z x) xs\n\n\n--foldl1           :: (a -> a -> a) -> [a] -> a\nfoldl1 f ((:) x xs)  = foldl f x xs\nfoldl1 _ []          = undefined -- error \"Prelude.foldl1: empty list\"\n\n\n--scanl            :: (a -> b -> a) -> a -> [b] -> [a]\n--scanl f q xs     = q : (case xs of\n--                            []   -> []\n--                            x:xs -> scanl f (f q x) xs)\n\n\n--scanl1          :: (a -> a -> a) -> [a] -> [a]\n--scanl1 f (x:xs) = scanl f x xs\n--scanl1 _ []     = []\n\n\n\n--foldr             :: (a -> b -> b) -> b -> [a] -> b\nfoldr f z []         = z\nfoldr f z ((:) x xs) = f x (foldr f z xs)\n\n--foldr1            ::  (a -> a -> a) -> [a] -> a\n--foldr1 f [x]      =   x\n--foldr1 f (x:xs)   =   f x (foldr1 f xs)\n--foldr1 _ []       =   error \"Prelude.foldr1: empty list\"\nfoldr1 f ixs = case ixs of\n  (:) x [] -> x\n  ((:) x xs) -> f x (foldr1 f xs)\n  [] -> undefined\n\n--scanr               :: (a -> b -> b) -> b -> [a] -> [b]\n--scanr f q0 []       = [q0]\n--scanr f q0 (x:xs) = f x q : qs\n--                       where qs@(q:_) = scanr f q0 xs\n\n--scanr1          ::   (a -> a -> a) -> [a] -> [a]\n--scanr1 f []     =    []\n--scanr1 f [x]    =    [x]\n--scanr1 f (x:xs) =    f x q : qs\n--                     where qs@(q:_) = scanr1 f xs\n\n--iterate     :: (a -> a) -> a -> [a]\niterate f x = x : iterate f (f x)\n\n--repeat   :: a -> [a]\n-- repeat x = xs where xs = x : xs\nrepeat x = x : repeat x\n\n--replicate     :: Int -> a -> [a]\nreplicate n x = take n (repeat x)\n\n--cycle    :: [a] -> [a]\ncycle [] = undefined -- error \"Prelude.cycle: empty list\"\n--cycle xs = xs' where xs' = xs ++ xs'\ncycle xs = xs ++ cycle xs\n\n--take                   :: Int -> [a] -> [a]\n--take n _      | n <= 0 =  []\n--take _ []              =  []\n--take n (x:xs)          =  x : take (n-1) xs\ntake n es = if n <= 0\n  then []\n  else case es of\n    [] -> []\n    ((:) x xs) -> x : take (n-1) xs\n\n--drop                   ::  Int -> [a] -> [a]\n--drop n xs     | n <= 0 =   xs\n--drop _ []              =   []\n--drop n (_:xs)          =   drop (n-1) xs\ndrop n ixs = if n <= 0\n  then ixs\n  else case ixs of\n    [] -> ixs\n    ((:) _ xs) -> drop (n-1) xs\n\n--splitAt                   :: Int -> [a] -> ([a],[a])\nsplitAt n xs              = (take n xs, drop n xs)\n\n--takeWhile               :: (a -> Bool) -> [a] -> [a]\n--takeWhile p []          = []\n--takeWhile p (x:xs)\n--            | px        =  x : takeWhile p xs\n--            | otherwise =  []\n\n--dropWhile               :: (a -> Bool) -> [a] -> [a]\n--dropWhile p []          = []\n--dropWhile p xs@(x:xs')\n--            | px        =  dropWhile p xs'\n--            | otherwise =  xs\n\n--span, break             :: (a -> Bool) -> [a] -> ([a],[a])\n--span p []            = ([],[])\n--span p xs@(x:xs')\n--            |px         = (x:ys,zs)\n--            | otherwise = ([],xs)\n--                           where (ys,zs) = span p xs'\n\n--break p                 =  span (not . p)\n\n--reverse :: [a] -> [a]\nreverse = foldl (flip (:)) []\n\n--and, or :: [Bool] -> Bool\nand     = foldr (&&) True\nor      = foldr (||) False\n\n--any, all :: (a -> Bool) -> [a] -> Bool\nany p xs = or (map p xs)\nall p xs = and (map p xs)\n\ninfix 4 `elem`, `notElem`\n--elem, notElem :: (Eq a) => a -> [a] -> Bool\nelem x xs     = any ((==) x) xs\nnotElem x xs  = all ((/=) x) xs\n\n--lookup           :: (Eq a) => a -> [(a,b)] -> Maybe b\n--lookup key []    = Nothing\n--lookup key ((x,y):xys)\n--    | key == x   = Just y\n--    | otherwise = lookup key xys\n\n--sum, product :: (Num a) => [a] -> a\nsum          = foldl (+) 0\nproduct      = foldl (*) 1\n\n--maximum, minimum :: (Ord a) => [a] -> a\nmaximum []       = undefined -- error \"Prelude.maximum: empty list\"\nmaximum xs       = foldl1 max xs\n\nminimum []       = undefined -- error \"Prelude.minimum: empty list\"\nminimum xs       = foldl1 min xs\n\n--zip  :: [a] -> [b] -> [(a,b)]\n--zip  = zipWith (,)\n\n--zip3 :: [a] -> [b] -> [c] -> [(a,b,c)]\n--zip3 = zipWith3 (,,)\n\n\n--zipWith          :: (a->b->c) -> [a]->[b]->[c]\n--zipWith z (a:as) (b:bs)\n--                 = z a b : zipWith z as bs\n--zipWith _ _ _    = []\n\n--zipWith3         :: (a->b->c->d) -> [a]->[b]->[c]->[d]\n--zipWith3 z (a:as) (b:bs) (c:cs)\n--                 = z a b c : zipWith3 z as bs cs\n--zipWith3 _ _ _ _ = []\n\n\n--unzip  :: [(a,b)] -> ([a],[b])\n--unzip  = foldr (\\(a,b) ~(as,bs) -> (a:as,b:bs)) ([],[])\n\n--unzip3 :: [(a,b,c)] -> ([a],[b],[c])\n--unzip3 = foldr (\\(a,b,c) ~(as,bs,cs) -> (a:as,b:bs,c:cs))\n--                ([],[],[])\n\n--------------------------------------------------------------------------------\n-- tuples\n\n--fst :: (a,b) -> a\nfst (x,y) = x\n\n--snd :: (a,b) -> b\nsnd (x,y) = y\n\n--curry :: ((a, b) -> c) -> a -> b -> c\n--curry f x y = f (x, y)\n\n--uncurry :: (a -> b -> c) -> ((a, b) -> c)\n--uncurry f p = f (fst p) (snd p)\n\n--------------------------------------------------------------------------------\n-- miscellaneous\n\n--until            :: (a -> Bool) -> (a -> a) -> a -> a\n--until p f x\n--  | p x        = x\n--  | otherwise  = until p f (f x)\n\n--------------------------------------------------------------------------------\n-- the Num class\n\nnegate = JSHC.Internal.int32negate\nabs = JSHC.Internal.int32abs\nsignum = JSHC.Internal.int32signum\n\n--------------------------------------------------------------------------------\n\ndata Char\ndata IO a = IO a\nenumFromTo a b = if a > b then [] else a : enumFromTo (a + 1) b\nstrLit = JSHC.Internal.strLit\nshow = JSHC.Internal.show\nputStr s = IO (JSHC.Internal.putStr s)\nputStrLn s = IO (JSHC.Internal.putStrLn s)\nprint x = putStrLn (show x)\nreturnIO x = IO x\nbindIO (IO a) f = seq a (f a)\nseqIO (IO a) b = seq a b\n","System.Environment":"\n{-\nsee Chapter 39 of the Haskell 2010 Language Report\n-}\n\nmodule System.Environment where\n\n","System.Exit":"\n{-\nsee Chapter 40 of the Haskell 2010 Language Report\n-}\n\nmodule System.Exit where\n\n","System.IO.Error":"\n{-\nsee Chapter 42 of the Haskell 2010 Language Report\n-}\n\nmodule System.IO.Error where\n\n","System.IO":"\n{-\nsee Chapter 41 of the Haskell 2010 Language Report\n-}\n\nmodule System.IO where\n\n"};
  function preprocessHaskell(src) {
    JSHC.Internal.__strs = [];
    var outSrc = "";
    var i = 0;
    while (i < src.length) {
      if (src[i] === "-" && src[i + 1] === "-") {
        var nl = src.indexOf("\n", i);
        if (nl === -1) { outSrc += src.slice(i); break; }
        outSrc += src.slice(i, nl); i = nl; continue;
      }
      if (src[i] === "\"") {
        var j = i + 1, s = "";
        while (j < src.length && src[j] !== "\"") {
          if (src[j] === "\\" && j + 1 < src.length) {
            var esc = src[j + 1];
            s += esc === "n" ? "\n" : esc === "t" ? "\t" : esc === "r" ? "\r" : esc;
            j += 2;
          } else { s += src[j++]; }
        }
        var idx = JSHC.Internal.__strs.length;
        JSHC.Internal.__strs.push(s);
        outSrc += "(strLit " + idx + ")";
        i = j + 1; continue;
      }
      outSrc += src[i++];
    }
    outSrc = outSrc.replace(/\[\s*([^\[\]\.]+?)\s*\.\.\s*([^\[\]\.]+?)\s*\]/g, "(enumFromTo ($1) ($2))");
    outSrc = outSrc.replace(/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*::.*\(\s*\).*$/gm, "");
    if (!/^\s*module\s+/m.test(outSrc)) outSrc = "module Main where\n" + outSrc;
    return outSrc;
  }
  JSHC.runHaskell = function(code) {
    JSHC.Internal.__stdout = "";
    var fsMap = Object.assign({}, JSHC.hslib);
    fsMap["Main"] = preprocessHaskell(code);
    var errs = [];
    var c = new JSHC.Compiler("hs");
    c.addMessageHandler(function(){});
    c.addWarningHandler(function(){});
    c.addErrorHandler(function(e){ errs.push(String(e)); });
    c.setFileSystem(fsMap);
    c.setTargets(["Main"]);
    c.recompile();
    if (errs.length || c.errors) throw new Error(errs.join("\n") || c.errorList.join("\n"));
    self.hs = {};
    (0, eval)(c.getAllJSCode());
    if (self.hs.Main && self.hs.Main.main !== undefined) {
      var res = showValue(self.hs.Main.main);
      if (JSHC.Internal.__stdout) return JSHC.Internal.__stdout.replace(/\n$/, "");
      return res;
    }
    return JSHC.Internal.__stdout.replace(/\n$/, "");
  };
})();

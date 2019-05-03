(function(global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    // CMD
    module.exports = factory(require("moment"));
  } else if (typeof define === "function" && define.amd) {
    // AMD. Register as parrot
    // TODO how to define the jquery plugin here?
    define(["moment"], factory);
  } else {
    // in browser, assump moment is loaded
    global.moment = factory(moment);
  }
})(typeof window !== "undefined" ? window : this, function(moment) {
  "use strict";

  // ///////////////////////////////////////////
  // Constants
  // ///////////////////////////////////////////
  var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|thYYYY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g,
    localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,
    parseTokenOneOrTwoDigits = /\d\d?/,
    parseTokenOneToThreeDigits = /\d{1,3}/,
    parseTokenThreeDigits = /\d{3}/,
    parseTokenFourDigits = /\d{1,4}/,
    parseTokenSixDigits = /[+\-]?\d{1,6}/,
    parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/i,
    parseTokenT = /T/i,
    parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/,
    formatFunctions = {},
    formatTokenFunctions = {
      thYYYY: function() {
        return this.thaiYear() + "";
      }
    };

  // ///////////////////////////////////////////
  // Helpers
  // ///////////////////////////////////////////
  function extend(a, b) {
    var key;
    for (key in b) if (b.hasOwnProperty(key)) a[key] = b[key];
    return a;
  }

  function objectCreate(parent) {
    function F() {}
    F.prototype = parent;
    return new F();
  }

  var setDate = function(m, year, month, date) {
    var d = m._d;
    if (m._isUTC) {
      /*eslint-disable new-cap*/
      m._d = new Date(
        Date.UTC(
          year,
          month,
          date,
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds()
        )
      );
      /*eslint-enable new-cap*/
    } else {
      m._d = new Date(
        year,
        month,
        date,
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds()
      );
    }
  };

  function toThai(year, month, day) {
    return {
      year: year + 543,
      month: month,
      day: day
    };
  }

  function toGregorian(year, month, day) {
    return {
      year: year - 543,
      month: month,
      day: day
    };
  }

  // ///////////////////////////////////////////
  // Parsing
  // ///////////////////////////////////////////
  function getParseRegexForToken(token, config) {
    switch (token) {
      case "YYYY":
      case "thYYYY":
        return parseTokenFourDigits;
      case "YYYYY":
        return parseTokenSixDigits;
      case "DDDD":
        return parseTokenThreeDigits;
      case "S":
      case "SS":
      case "SSS":
      case "DDD":
        return parseTokenOneToThreeDigits;
      case "MMM":
      case "MMMM":
      case "dd":
      case "ddd":
      case "dddd":
        return parseTokenWord;
      case "X":
        return parseTokenTimestampMs;
      case "Z":
      case "ZZ":
        return parseTokenTimezone;
      case "T":
        return parseTokenT;
      case "MM":
      case "DD":
      case "YY":
      case "HH":
      case "hh":
      case "mm":
      case "ss":
      case "M":
      case "D":
      case "d":
      case "H":
      case "h":
      case "m":
      case "s":
        return parseTokenOneOrTwoDigits;
      default:
        return new RegExp(token.replace("\\", ""));
    }
  }

  function addThaiYearFromToken(token, input, config) {
    switch (token) {
      case "thYYYY":
        // Convert a function's string argument to a number.
        config._bYear = ~~input;
        break;
    }

    if (input == null) {
      config._isValid = false;
    }
  }

  /**
   * Create moment by given configuration with multiple formats.
   * Score of moment is left length of formatting. return moment object with minimum score.
   * @param config
   * @param utc
   * @returns {*}
   */
  function makeDateFromStringAndArray(config, utc) {
    if (config._f.length === 0) {
      return makeMoment(new Date(NaN));
    }

    var moments = config._f.map(function(format) {
      var currentScore = 0;
      var tempMoment = makeMoment(config._i, format, config._l, config._strict, utc);
      if (tempMoment.isValid()) {
        if (tempMoment._leftLength) {
          currentScore += tempMoment._leftLength.length;
        }
      }

      return {
        score: currentScore,
        moment: tempMoment
      };
    });

    moments.sort(function(m1, m2) {
      return m1.score - m2.score;
    });

    return moments[0].moment;
  }

  function makeDateFromStringAndFormat(config) {
    var tokens = config._f.match(formattingTokens);
    var string = config._i + "";

    // Loop through the tokens.
    tokens.forEach(function(token) {
      // Find a matched text for each token.
      var matchedText = (getParseRegexForToken(token, config).exec(string) || [])[0];

      // Cut out the matched text from the string.
      if (matchedText) {
        string = string.slice(string.indexOf(matchedText) + matchedText.length);
      }

      if (formatTokenFunctions[token]) {
        addThaiYearFromToken(token, matchedText, config);
      }
    });

    if (string) {
      config._leftLength = string;
    }

    return thaiYearFromConfig(config);
  }

  /**
   * Remove buddhist era year path from the input and the format string.
   *
   * @param {Object} config Moment configurations
   * @returns True when finding the removed path, False otherwise.
   */
  function removeBuddhistEraTokens(config) {
    var string = config._i + "";
    var input = "";
    var format = "";
    var tokens = config._f.match(formattingTokens);

    tokens.forEach(function(token) {
      var matchedText = (getParseRegexForToken(token, config).exec(string) || [])[0];
      if (matchedText) {
        string = string.slice(string.indexOf(matchedText) + matchedText.length);
      }
      if (!(formatTokenFunctions[token] instanceof Function)) {
        format += token;
        if (matchedText) {
          input += matchedText;
        }
      }
    });

    config._i = input;
    var orgFormat = config._f;
    config._f = format;
    return orgFormat != format;
  }

  function thaiYearFromConfig(config) {
    return config._bYear;
  }

  // ///////////////////////////////////////////
  // Formatting
  // ///////////////////////////////////////////
  var makeFormatFunction = function(format) {
    var array = format.match(formattingTokens);
    var length = array.length;
    var i;

    array.forEach(function(element, index) {
      if (formatTokenFunctions[element]) {
        array[index] = formatTokenFunctions[element];
      }
    });

    return function(mom) {
      var output = "";
      for (i = 0; i < length; i += 1) {
        output += array[i] instanceof Function ? "[" + array[i].call(mom, format) + "]" : array[i];
      }
      return output;
    };
  };

  // ///////////////////////////////////////////
  // Top Level Functions
  // ///////////////////////////////////////////
  function makeMoment(input, format, lang, strict, utc) {
    if (typeof lang === "boolean") {
      strict = lang;
      lang = undefined;
    }

    if (format && typeof format === "string") format = fixFormat(format, moment);

    var config = {
      _i: input,
      _f: format,
      _l: lang,
      _strict: strict,
      _isUTC: utc
    };
    var origInput = input;
    var origFormat = format;

    if (format) {
      if (Array.isArray(format)) {
        // Create moment by given multiple formats
        return makeDateFromStringAndArray(config, utc);
      } else {
        // Create moment by given single format
        var year = makeDateFromStringAndFormat(config);
        var removed = removeBuddhistEraTokens(config);
        if (removed) {
          format = "YYYY-" + config._f;
          // Not found the buddhist era year format.
          if (typeof year === "undefined") {
            // No the buddhist era year parsed, let it be invalid
            input = "ABCD-" + config._i;
          } else {
            input = toGregorian(year, 0, 0).year + "-" + config._i;
          }
        } else {
          // Keep original.
          format = origFormat;
          input = origInput;
        }
      }
    }

    var orgMoment;
    if (utc) orgMoment = moment.utc(input, format, lang, strict);
    else orgMoment = moment(input, format, lang, strict);
    if (config._isValid === false) {
      orgMoment._isValid = false;
    }
    var newMoment = objectCreate(MomentThaiYear.fn);
    extend(newMoment, orgMoment);
    if (strict && newMoment.isValid()) {
      newMoment._isValid = newMoment.format(origFormat) === origInput;
    }

    return newMoment;
  }

  // MomentThaiYear prototype object
  function MomentThaiYear(input, format, lang, strict) {
    return makeMoment(input, format, lang, strict, false);
  }

  extend(MomentThaiYear, moment);
  MomentThaiYear.fn = objectCreate(moment.fn);

  MomentThaiYear.utc = function(input, format, lang, strict) {
    return makeMoment(input, format, lang, strict, true);
  };

  MomentThaiYear.unix = function(input) {
    return makeMoment(input * 1000);
  };

  // ///////////////////////////////////////////
  // MomentThaiYear Prototypes
  // ///////////////////////////////////////////
  function fixFormat(format, mom) {
    var i = 5;
    var replace = function(input) {
      return mom.localeData().longDateFormat(input) || input;
    };
    while (i > 0 && localFormattingTokens.test(format)) {
      i -= 1;
      format = format.replace(localFormattingTokens, replace);
    }

    return format;
  }

  MomentThaiYear.fn.format = function(format) {
    if (format) {
      format = fixFormat(format, this);

      if (!formatFunctions[format]) {
        formatFunctions[format] = makeFormatFunction(format);
      }
      format = formatFunctions[format](this);
    }

    return moment.fn.format.call(this, format);
  };

  MomentThaiYear.fn.thaiYear = function(input) {
    if (typeof input === "number") {
      th = toThai(this.year(), this.month(), this.date());
      gregorian = toGregorian(input, th.month, th.day);
      setDate(this, th.year, th.month, th.day);
      moment.updateOffset(this);
      return this;
    }

    return toThai(this.year(), this.month(), this.date()).year;
  };

  return MomentThaiYear;
});

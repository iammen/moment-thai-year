(function() {
  function append(string) {
    html += string + "<br>";
  }

  var html = "";
  var date = moment();
  append(date);
  append(date.format("YYYY/MM/DD"));
  append(date.format("LLLL"));
  append(date.format("LLL"));

  append(date.format("YYYY-MM-DD"));

  var date = moment("2562/05/17", "bYYYY/MM/DD");
  append(date.format("DD MMM bYYYY"));
  append(date.year());

  date = moment("2018/10/02", "YYYY/MM/DD");
  append(date.format("bYYYY/MM/DD"));

  date = moment("2011/10/02", "YYYY/MM/DD");
  append(date.format("bYYYY/MM/DD"));

  date = moment("2000/10/02", "YYYY/MM/DD");
  append(date.format("tYY/MM/DD"));

  date = moment();
  append(date.format("ปี bYYYY"));

  date = moment("10/12/2560", "MM/DD/bYYYY");
  append(date.format("YYYY/MM/DD"));

  $("#msg").html(html);
})();

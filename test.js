//up to Base75
function convertBase(value, from_base, to_base) {
    value = value.toString();
    var range = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*_=()[]!.,`'".split('');
    var from_range = range.slice(0, from_base);
    var to_range = range.slice(0, to_base);
    
    var dec_value = value.split('').reverse().reduce(function (carry, digit, index) {
      if (from_range.indexOf(digit) === -1) throw new Error('Invalid digit `'+digit+'` for base '+from_base+'.');
      carry += from_range.indexOf(digit) * (Math.pow(from_base, index));
      //console.log(carry);

      return carry;
    }, 0);
    
    var new_value = '';
    while (dec_value > 0) {
      new_value = to_range[dec_value % to_base] + new_value;
      dec_value = (dec_value - (dec_value % to_base)) / to_base;
      //console.log(`${new_value} => (${dec_value} - (${dec_value} % ${to_base})) / ${to_base} `);
    }
    return new_value || '0';
  }


let cardId = 15;
let count = 5;

var range = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*_=()[]!.,`'".split('');
// console.log(range.length);
// for (var i = 11; i > 2; i--)
// {
//     let newCardId = convertBase(cardId.toString(), 10, i-1);
//     let newCount = convertBase(count.toString(), 10, i-1);
//     let cardString = `${newCardId}${range[i-1]}${newCount}`;

//     console.log(`${cardString} => ${convertBase(cardString, i, 71)}`);
// }

// for (var i = 2; i<76; i++)
// {
//     let numString = convertBase((i*2-1).toString(), 10, i);
//     numString = convertBase("15a2", 11, i);
//     numString = convertBase(i-1, 10, i);
//     console.log(`${i} => ${numString}`);
// }

let teststr = "72106aa6";
let testresult = convertBase(teststr, 11, 75);
console.log(testresult);


teststr = "4dJ9DjIGo9YG!*Gh`0GEmVC73M-uBNE0Ok!WDUwrFmV1C)WURt";
teststr = "4wa_V";
testresult = convertBase(teststr, 75, 11);

console.log(testresult);


// console.log(convertBase("15a2", 11, 62));
// console.log(convertBase("15a2", 11, 62));

function findMode(array) {
  // find the number of occurence of each element.
  const count = {};
  for (const arrayElement of array) {
    if (count[arrayElement] === undefined) {
      count[arrayElement] = 0;
    }
    count[arrayElement] += 1;
  }
  // return the element(s) with the max number of occurence.
  const max = Math.max(...Object.values(count));
  const modes = [];
  for (const arrayElement of array) {
    if (count[arrayElement] === max) {
      modes.push(arrayElement);
    }
  }
  // for (const arrayElement in count) {
  //   if (Object.hasOwnProperty.call(count, arrayElement)) {
  //     if (count[arrayElement] === max) {
  //       modes.push(arrayElement);
  //     }
  //   }
  // }
  return modes;
}

export default findMode;

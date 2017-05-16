export let delay = time => new Promise(resolve => setTimeout(resolve, time));

export let uid = (() => {
    let counter = 0;

    return () => ++counter;
})();


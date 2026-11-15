document.body.onkeydown = function( e ) {
    if (!current || !current.length) return; // Offline edition: ignore keys until Play.
    if ([32,37,38,39,40].includes(e.keyCode)) e.preventDefault();
    var keys = {
        37: 'left',
        39: 'right',
        40: 'down',
        38: 'rotate',
        32: 'drop'
    };
    if ( typeof keys[ e.keyCode ] != 'undefined' ) {
        keyPress( keys[ e.keyCode ] );
        render();
    }
};

canvasFixedSize=vec2(960,540);canvasPixelated=false;debugWatermark=false;showEngineVersion=false;
function gameUpdate(){}
function gameUpdatePost(){}
function gameRender(){}
function gameRenderPost(){}
class Player extends EngineObject
{
    constructor(pos)
    {
        super(pos, vec2(1,2), tile(8), 0, RED);
        this.setCollision(); // make object collide
        this.angleDamping = .95;
    }

    update()
    {
        // space ship controls
        const moveInput = keyDirection();
        this.applyAngularAcceleration(moveInput.x * .002);
        const accel = this.getUp(moveInput.y*.002);
        this.applyAcceleration(accel);
    }

    // explode when it collides
    collideWithObject()
    {
        // don't explode if player is almost still and pointing up
        if (cos(this.angle) > .98)
        if (this.velocity.length() < .05)
            return true;

        // explode!
        this.destroy();
        particleEffect('explosion', this.pos, {scale: 1.5});
    }
}

function gameInit()
{
    // setup level
    gravity.y = -.001;
    new Player(vec2(0,4));

    // create ground
    for (let i=0, y=0; i<20; ++i)
    {
        y = (y + rand(1,-1)*4) * .5;
        const pos = vec2(i*2-20, y-54);
        const color = hsl(0, 0, .5+i%.29);
        const o = new EngineObject(pos, vec2(2, 99), 0, 0, color);
        o.setCollision(); // make object collide
        o.mass = 0; // make object have static physics
    }
}


engineInit(gameInit,gameUpdate,gameUpdatePost,gameRender,gameRenderPost,['tiles.png']);

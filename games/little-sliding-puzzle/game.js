canvasFixedSize=vec2(960,540);canvasPixelated=false;debugWatermark=false;showEngineVersion=false;
function gameUpdate(){}
function gameUpdatePost(){}
function gameRender(){}
const gridSize = vec2(4,3);
const pieceSize = vec2(5,4);
let emptyGridPos = vec2();

class PuzzlePiece extends EngineObject
{
    constructor(gridPos, size)
    {
        const x = gridPos.x, y = gridPos.y;
        const color = hsl(.5 + x/(gridSize.x-1)/3, 1, .4 + y/(gridSize.y-1)/3);
        super(gridPos.multiply(size), size, 0, 0, color);
        this.gridPos = gridPos;
        this.text = x + y*gridSize.x;
        this.moveTimer = new Timer;
        this.lastPos = this.pos;
    }

    update()
    {
        const deltaX = emptyGridPos.x - this.gridPos.x;
        const deltaY = emptyGridPos.y - this.gridPos.y;
        if (mouseWasPressed(0))
        if (this.isOverlapping(mousePos))
        if (abs(deltaX) + abs(deltaY) === 1)
        {
            // swap with empty space when clicked on
            this.lastPos = this.pos;
            this.pos = emptyGridPos.multiply(this.size);
            [emptyGridPos, this.gridPos] = [this.gridPos, emptyGridPos];
            this.moveTimer.set(.2);
        }
    }

    render()
    {
        const movePercent = this.moveTimer.getPercent();
        const pos = this.lastPos.lerp(this.pos, movePercent);
        drawRect(pos, this.size, this.color);
        drawText(this.text, pos, 2.5, BLACK);
    }
}

function gameInit()
{
    // create puzzle pieces
    for (let x=gridSize.x; x--;)
    for (let y=gridSize.y; y--;)
        (x||y) && new PuzzlePiece(vec2(x,y), pieceSize);

    // center camera on grid
    cameraPos = gridSize.subtract(vec2(1)).multiply(pieceSize).scale(.5);
}


const originalInit=gameInit; gameInit=function(){originalInit();for(let i=0;i<300;i++){const choices=engineObjects.filter(p=>p.gridPos&&abs(p.gridPos.x-emptyGridPos.x)+abs(p.gridPos.y-emptyGridPos.y)===1);const p=choices[randInt(choices.length)];const old=p.gridPos;p.gridPos=emptyGridPos;emptyGridPos=old;p.pos=p.lastPos=p.gridPos.multiply(pieceSize);} };function gameRenderPost(){if(engineObjects.every(p=>!p.gridPos||p.text===p.gridPos.x+p.gridPos.y*gridSize.x))drawTextScreen('Solved! Restart for another puzzle',vec2(mainCanvasSize.x/2,35),26);}

engineInit(gameInit,gameUpdate,gameUpdatePost,gameRender,gameRenderPost,['tiles.png']);

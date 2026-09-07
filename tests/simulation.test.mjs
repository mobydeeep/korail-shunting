import {test} from 'node:test';
import assert from 'node:assert/strict';
import {YardSimulation} from '../simulation.js';

function run(s,seconds=20){for(let i=0;i<seconds*50;i++)s.tick(.02);}
function approach(s){s.setDirection(1);run(s,5);assert.ok(s.gap(0)<.0001);assert.equal(s.direction,0);}
function reach(s,i){s.player.x=s.couplerX(i);s.player.z=2.9;}

test('full mission: approach, couple, transfer, uncouple and extract',()=>{
  const s=new YardSimulation();approach(s);reach(s,0);
  assert.equal(s.interact('connect'),true);assert.equal(s.phase,1);
  s.setDirection(1);run(s);assert.equal(s.phase,2);assert.ok(Math.abs(s.cars[3]-18)<.001);
  reach(s,2);assert.equal(s.interact('uncouple'),true);assert.equal(s.phase,3);
  s.setDirection(-1);run(s);assert.equal(s.phase,4);assert.equal(s.score,1000);
  assert.ok(Math.abs(s.cars[3]-18)<.001);assert.deepEqual(s.links,[true,true,false]);assert.equal(s.moving(),false);
  assert.ok(s.gap(2)>=3.99);
});
test('cannot connect across a gap, remotely, or while moving',()=>{
  const s=new YardSimulation();reach(s,0);assert.equal(s.interact('connect'),false);
  s.setDirection(1);assert.equal(s.interact('connect'),false);run(s,5);
  s.player.x=25;assert.equal(s.interact('connect'),false);
  reach(s,0);assert.equal(s.interact('connect'),true);
});
test('mission preserves task order and designated separation boundary',()=>{
  const s=new YardSimulation();reach(s,2);assert.equal(s.interact('uncouple'),false);
  approach(s);reach(s,0);s.interact('connect');s.setDirection(1);run(s);
  reach(s,0);assert.equal(s.interact('uncouple'),false);
  s.setDirection(1);assert.equal(s.moving(),false);assert.equal(s.phase,2);
});
test('a worker in the swept path causes an emergency stop before impact',()=>{
  const s=new YardSimulation();s.player={x:-12.72,z:0,facing:0};
  const position=s.cars[0];s.setDirection(1);s.tick(.04);
  assert.equal(s.moving(),false);assert.equal(s.cars[0],position);assert.ok(s.events.some(e=>e.type==='warning'));
});
test('uncoupled wagons stay still, contact does not overlap, and recoupling works',()=>{
  const s=new YardSimulation();s.reset('free');approach(s);reach(s,0);s.interact('connect');
  reach(s,1);assert.equal(s.interact('uncouple'),true);
  const detached=s.cars.slice(2);s.setDirection(-1);run(s,4);
  assert.deepEqual(s.cars.slice(2),detached);assert.ok(s.gap(1)>3);
  s.setDirection(1);run(s,6);assert.equal(s.direction,0);assert.ok(Math.abs(s.gap(1))<.001);
  reach(s,1);assert.equal(s.interact('connect'),true);assert.deepEqual(s.component(),[0,1,2,3]);
});
test('pausing freezes both simulation time and vehicle positions',()=>{
  const s=new YardSimulation();s.setDirection(1);s.paused=true;const cars=[...s.cars];
  run(s);assert.deepEqual(s.cars,cars);assert.equal(s.elapsed,0);
  s.paused=false;run(s,1);assert.ok(s.elapsed>.9);assert.ok(s.cars[0]>cars[0]);
});
test('movement collision prevents walking through a wagon or outside yard',()=>{
  const s=new YardSimulation();s.player.x=-6;s.player.z=2.1;
  for(let i=0;i<50;i++)s.movePlayer(0,-1,.02);
  assert.ok(s.player.z>=1.72);
  s.player.x=38.9;s.player.z=3;for(let i=0;i<50;i++)s.movePlayer(1,0,.02);
  assert.ok(s.player.x<=39);
});
test('free play stays within track limits and restart clears progress',()=>{
  const s=new YardSimulation();s.reset('free');s.setDirection(-1);run(s,100);
  assert.ok(s.cars[0]-4>=-38);assert.equal(s.moving(),false);
  s.reset();assert.equal(s.score,0);assert.equal(s.elapsed,0);assert.equal(s.phase,0);
  assert.deepEqual(s.cars,[-17.5,-6,2,10]);assert.deepEqual(s.links,[false,true,true]);
});

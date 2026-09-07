export const CAR_LENGTHS = [8, 7, 7, 7];
export const CAR_NAMES = ['7501', 'A101', 'A102', 'B201'];
export const TRAVEL_SPEED = 0.85;
export const DESTINATION = 2;
export const PHASE_LABELS = ['기관차 · 화차 연결', '지정 구역으로 이동', 'B201 화차 분리', '나머지 편성 인출', '입환작업 완료'];

export class YardSimulation {
  constructor() { this.reset(); }
  reset(mode = 'mission') {
    this.mode = mode;
    this.cars = [-17.5, -6, 2, 10];
    this.links = [false, true, true];
    this.player = { x: -10.3, z: 3.65, facing: Math.PI };
    this.direction = 0;
    this.speed = 0;
    this.phase = 0;
    this.score = 0;
    this.elapsed = 0;
    this.paused = false;
    this.extractionStart = null;
    this.events = [];
    this.penaltyCooldown = 0;
    this.playerDistance = 0;
  }
  notify(message, type = 'info') { this.events.push({message, type}); }
  component(index = 0) {
    const members = [index];
    for(let i = index - 1; i >= 0 && this.links[i]; i--) members.unshift(i);
    for(let i = index; i < 3 && this.links[i]; i++) members.push(i + 1);
    return members;
  }
  gap(i) { return this.cars[i+1] - this.cars[i] - (CAR_LENGTHS[i]+CAR_LENGTHS[i+1])/2 - 1; }
  couplerX(i) {
    const a = this.cars[i] + CAR_LENGTHS[i]/2 + .5;
    const b = this.cars[i+1] - CAR_LENGTHS[i+1]/2 - .5;
    return (a+b)/2;
  }
  distanceTo(i) {
    return Math.hypot(this.player.x-this.couplerX(i), Math.abs(this.player.z)-2.65);
  }
  nearestCoupler() {
    let index = 0;
    for(let i=1;i<3;i++) if(this.distanceTo(i)<this.distanceTo(index)) index=i;
    return index;
  }
  canReach(i) { return Math.abs(this.player.z) >= 2.05 && this.distanceTo(i) <= 2.3; }
  moving() { return this.direction !== 0; }
  advance() {
    if(this.mode !== 'mission') return;
    this.phase++;
    this.score += 250;
    this.notify(this.phase===4 ? '입환작업 완료! B201 화차 유치에 성공했습니다.' : `작업 완료 +250 · 다음: ${PHASE_LABELS[this.phase]}`, 'success');
  }
  setDirection(dir) {
    if(this.paused || (this.mode==='mission' && this.phase===4)) return;
    if(dir!==0 && this.mode==='mission') {
      if(this.phase===0 && dir<0) { this.notify('먼저 ‘밀기’로 기관차를 오른쪽 화차에 접근시키세요.'); return; }
      if(this.phase===2) { this.notify('먼저 A102 · B201 연결기 옆으로 이동해 B201을 분리하세요.'); return; }
      if(this.phase===3 && dir>0) { this.notify('이제 ‘당기기’로 나머지 편성을 왼쪽으로 인출하세요.'); return; }
    }
    this.direction = Math.sign(dir);
    this.speed = Math.abs(this.direction)*TRAVEL_SPEED;
  }
  stop() { this.direction=0; this.speed=0; }
  interact(action, explicitIndex) {
    if(this.paused || (this.mode==='mission' && this.phase===4)) return false;
    if(this.moving()) { this.notify('차량이 움직이고 있습니다. 정지(Space) 후 작업하세요.', 'warning'); return false; }
    const i=explicitIndex??this.nearestCoupler();
    if(!this.canReach(i)) { this.notify('연결기 옆 표식으로 더 가까이 이동하세요. 표식을 클릭해도 이동합니다.'); return false; }
    if(action==='connect') {
      if(this.links[i]) { this.notify('이미 연결된 화차입니다. 분리하려면 R을 누르세요.'); return false; }
      if(this.mode==='mission' && (this.phase!==0 || i!==0)) { this.notify('현재 미션의 파란 표식을 따라 작업하세요.'); return false; }
      if(this.gap(i)>.12) { this.notify('연결기 사이가 멉니다. 무전 ‘밀기’로 기관차를 접근시키세요.'); return false; }
      this.links[i]=true;
      this.notify(`${CAR_NAMES[i]} · ${CAR_NAMES[i+1]} 연결 완료`, 'couple');
      if(this.mode==='mission' && this.phase===0 && i===0) this.advance();
      else this.score+=100;
      return true;
    }
    if(!this.links[i]) { this.notify('이미 분리되어 있습니다. 연결하려면 E를 누르세요.'); return false; }
    if(this.mode==='mission' && (this.phase!==2 || i!==2)) { this.notify(this.phase<2?'지정 구역으로 이동한 뒤 B201 화차를 분리하세요.':'이번 미션에서는 A102 · B201 사이를 분리하세요.'); return false; }
    this.links[i]=false;
    this.notify(`${CAR_NAMES[i]} · ${CAR_NAMES[i+1]} 분리 완료`, 'uncouple');
    if(this.mode==='mission' && this.phase===2 && i===2) { this.extractionStart=this.cars[0]; this.advance(); }
    else this.score+=100;
    return true;
  }
  blocked(x,z, margin=.22) {
    if(x < -39 || x > 39 || z < -3.7 || z > 10.4) return true;
    if(Math.abs(z)>1.5+margin) return false;
    return this.cars.some((cx,i)=>Math.abs(x-cx)<CAR_LENGTHS[i]/2+.46+margin);
  }
  movePlayer(dx,dz,dt) {
    if(this.paused || (this.mode==='mission' && this.phase===4)) return false;
    const length=Math.hypot(dx,dz);
    if(length<.001) return false;
    dx/=length; dz/=length;
    const distance=2.8*dt;
    let moved=false;
    if(!this.blocked(this.player.x+dx*distance,this.player.z)){this.player.x+=dx*distance;moved=true;}
    if(!this.blocked(this.player.x,this.player.z+dz*distance)){this.player.z+=dz*distance;moved=true;}
    this.player.facing=Math.atan2(dx,dz);
    if(moved) this.playerDistance+=distance;
    return moved;
  }
  tick(dt) {
    if(this.paused || (this.mode==='mission' && this.phase===4)) return;
    dt=Math.max(0,Math.min(dt,.05));
    this.elapsed+=dt;
    this.penaltyCooldown=Math.max(0,this.penaltyCooldown-dt);
    if(!this.direction) return;
    const members=this.component();
    let delta=this.direction*TRAVEL_SPEED*dt;
    const dir=this.direction;
    // Swept bounding boxes prevent the locomotive moving into the worker.
    if(Math.abs(this.player.z)<2.05 && members.some(i=>this.player.x>=Math.min(this.cars[i],this.cars[i]+delta)-CAR_LENGTHS[i]/2-.8 && this.player.x<=Math.max(this.cars[i],this.cars[i]+delta)+CAR_LENGTHS[i]/2+.8)) {
      this.stop();
      if(!this.penaltyCooldown){this.score=Math.max(0,this.score-50);this.penaltyCooldown=3;this.notify('진로에 작업자가 있습니다. 차량이 정지했습니다. 선로 옆으로 이동하세요.', 'warning');}
      return;
    }
    // Physical order is fixed on a single track. Uncoupled vehicles stop at coupler contact.
    const last=members[members.length-1];
    if(dir>0 && last<3){
      const room=Math.max(0,this.gap(last));
      if(delta>=room){delta=room;this.stop();this.notify('연결기 접촉 지점에 정지했습니다. 옆에서 E로 연결하세요.');}
    }
    const first=members[0];
    if(this.cars[first]+delta-CAR_LENGTHS[first]/2 < -38 || this.cars[last]+delta+CAR_LENGTHS[last]/2 > 37){this.stop();this.notify('작업선 끝입니다. 반대 방향으로 이동하세요.');return;}
    if(this.mode==='mission' && this.phase===1 && members.includes(1) && dir>0 && this.cars[1]+delta>=DESTINATION){delta=DESTINATION-this.cars[1];this.stop();}
    if(this.mode==='mission' && this.phase===3 && dir<0 && this.cars[0]+delta<=this.extractionStart-4){delta=this.extractionStart-4-this.cars[0];this.stop();}
    for(const i of members)this.cars[i]+=delta;
    if(this.mode==='mission' && this.phase===1 && Math.abs(this.cars[1]-DESTINATION)<.01 && !this.moving())this.advance();
    if(this.mode==='mission' && this.phase===3 && this.cars[0]<=this.extractionStart-3.999 && !this.moving())this.advance();
  }
}

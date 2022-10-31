(function(){"use strict";var e={8106:function(e,t,n){var u=n(9242),o=n(2026),a=n(3396),l=n(7139);const s={class:"addbtn"},i={key:0,class:"addbtn"},r=(0,a._)("b",{style:{color:"green"}},"correta",-1),d=(0,a._)("br",null,null,-1),m=(0,a._)("b",{style:{color:"red"}},"incorreta",-1),p=(0,a._)("br",null,null,-1),c=(0,a._)("b",{style:{color:"red"}},"incorreta",-1),f=(0,a._)("br",null,null,-1),w=(0,a._)("b",{style:{color:"red"}},"incorreta",-1);function h(e,t,n,u,o,h){const b=(0,a.up)("b-navbar-brand"),g=(0,a.up)("b-nav-item"),_=(0,a.up)("b-navbar-nav"),v=(0,a.up)("b-navbar"),Q=(0,a.up)("b-alert"),q=(0,a.up)("b-button"),k=(0,a.up)("QuestionBlock"),W=(0,a.up)("b-container"),V=(0,a.up)("b-form-textarea"),U=(0,a.up)("b-form-group"),y=(0,a.up)("b-form-text"),M=(0,a.up)("b-form-input"),O=(0,a.up)("b-form"),j=(0,a.up)("b-modal");return(0,a.wg)(),(0,a.iD)(a.HY,null,[(0,a.Wm)(v,{variant:"light"},{default:(0,a.w5)((()=>[(0,a.Wm)(b,{href:"#"},{default:(0,a.w5)((()=>[(0,a.Uk)("ZecQuiz")])),_:1}),(0,a.Wm)(_,null,{default:(0,a.w5)((()=>[(0,a.Wm)(g,{onClick:t[0]||(t[0]=e=>h.changeLanguage("pt"))},{default:(0,a.w5)((()=>[(0,a.Uk)("Português")])),_:1}),(0,a.Wm)(g,{onClick:t[1]||(t[1]=e=>h.changeLanguage("en"))},{default:(0,a.w5)((()=>[(0,a.Uk)("English")])),_:1})])),_:1})])),_:1}),(0,a.Wm)(W,null,{default:(0,a.w5)((()=>[(0,a.Wm)(Q,{show:""},{default:(0,a.w5)((()=>[(0,a.Uk)((0,l.zw)(e.questions.length)+" perguntas cadastradas.",1)])),_:1}),(0,a._)("div",s,[(0,a.Wm)(q,{variant:"info",onClick:t[2]||(t[2]=e=>this.newModal=!this.newModal)},{default:(0,a.w5)((()=>[(0,a.Uk)("Cadastrar nova pergunta")])),_:1})]),((0,a.wg)(!0),(0,a.iD)(a.HY,null,(0,a.Ko)(e.questions,(t=>((0,a.wg)(),(0,a.j4)(k,{key:e.questions.indexOf(t),ques:t,onDeleteQuestion:h.deleteQuestion,onUpdateQuestion:h.updateQuestion},null,8,["ques","onDeleteQuestion","onUpdateQuestion"])))),128)),e.questions.length>0?((0,a.wg)(),(0,a.iD)("div",i,[(0,a.Wm)(q,{variant:"info",onClick:t[3]||(t[3]=e=>this.newModal=!this.newModal)},{default:(0,a.w5)((()=>[(0,a.Uk)("Cadastrar nova pergunta")])),_:1})])):(0,a.kq)("",!0)])),_:1}),(0,a.Wm)(j,{id:"new-modal",modelValue:e.newModal,"onUpdate:modelValue":t[9]||(t[9]=t=>e.newModal=t),title:"Cadastrar pergunta",onOk:t[10]||(t[10]=e=>h.insertNewQuestion())},{default:(0,a.w5)((()=>[(0,a.Wm)(W,{fluid:""},{default:(0,a.w5)((()=>[(0,a.Wm)(O,{ref:"form",autocomplete:"off"},{default:(0,a.w5)((()=>[(0,a.Wm)(U,{label:"Enunciado / Pergunta","label-for":"input-question"},{default:(0,a.w5)((()=>[(0,a.Wm)(V,{id:"input-question",modelValue:this.newQues.question,"onUpdate:modelValue":t[4]||(t[4]=e=>this.newQues.question=e),rows:"6",required:""},null,8,["modelValue"])])),_:1}),(0,a.Wm)(U,{label:"Respostas","label-for":"input-answer0"},{default:(0,a.w5)((()=>[(0,a.Wm)(y,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),r])),_:1}),(0,a.Wm)(M,{id:"input-answer0",modelValue:this.newQues.answers[0],"onUpdate:modelValue":t[5]||(t[5]=e=>this.newQues.answers[0]=e),required:""},null,8,["modelValue"]),d,(0,a.Wm)(y,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),m])),_:1}),(0,a.Wm)(M,{id:"input-answer1",modelValue:this.newQues.answers[1],"onUpdate:modelValue":t[6]||(t[6]=e=>this.newQues.answers[1]=e),required:""},null,8,["modelValue"]),p,(0,a.Wm)(y,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),c])),_:1}),(0,a.Wm)(M,{id:"input-answer2",modelValue:this.newQues.answers[2],"onUpdate:modelValue":t[7]||(t[7]=e=>this.newQues.answers[2]=e)},null,8,["modelValue"]),f,(0,a.Wm)(y,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),w])),_:1}),(0,a.Wm)(M,{id:"input-answer3",modelValue:this.newQues.answers[3],"onUpdate:modelValue":t[8]||(t[8]=e=>this.newQues.answers[3]=e)},null,8,["modelValue"])])),_:1})])),_:1},512)])),_:1})])),_:1},8,["modelValue"])],64)}n(7658);const b=e=>((0,a.dD)("data-v-97560280"),e=e(),(0,a.Cn)(),e),g={class:"question"},_={class:"title"},v={class:"answer"},Q=b((()=>(0,a._)("strong",null,"Tem certeza que deseja remover essa pergunta?",-1))),q=b((()=>(0,a._)("b",{style:{color:"green"}},"correta",-1))),k=b((()=>(0,a._)("br",null,null,-1))),W=b((()=>(0,a._)("b",{style:{color:"red"}},"incorreta",-1))),V=b((()=>(0,a._)("br",null,null,-1))),U=b((()=>(0,a._)("b",{style:{color:"red"}},"incorreta",-1))),y=b((()=>(0,a._)("br",null,null,-1))),M=b((()=>(0,a._)("b",{style:{color:"red"}},"incorreta",-1)));function O(e,t,n,u,o,s){const i=(0,a.up)("b-button"),r=(0,a.up)("b-modal"),d=(0,a.up)("b-form-textarea"),m=(0,a.up)("b-form-group"),p=(0,a.up)("b-form-text"),c=(0,a.up)("b-form-input"),f=(0,a.up)("b-form"),w=(0,a.up)("b-container");return(0,a.wg)(),(0,a.iD)(a.HY,null,[(0,a._)("div",g,[(0,a._)("span",_,[(0,a._)("h3",null,[(0,a.Uk)("Pergunta: "),(0,a._)("code",null,(0,l.zw)(n.ques.question),1)])]),(0,a._)("span",v,[(0,a._)("h4",null,[(0,a.Uk)("Resposta: "),(0,a._)("strong",null,(0,l.zw)(n.ques.answers[0]),1)])]),(0,a._)("span",null,[(0,a.Wm)(i,{variant:"primary",onClick:t[0]||(t[0]=e=>s.editQuestion())},{default:(0,a.w5)((()=>[(0,a.Uk)("Editar pergunta ")])),_:1}),(0,a.Uk)("   "),(0,a.Wm)(i,{variant:"danger",onClick:t[1]||(t[1]=e=>this.removeModal=!0)},{default:(0,a.w5)((()=>[(0,a.Uk)("Remover pergunta")])),_:1})])]),(0,a.Wm)(r,{id:"remove-modal",modelValue:o.removeModal,"onUpdate:modelValue":t[2]||(t[2]=e=>o.removeModal=e),title:"Confirmar",onOk:t[3]||(t[3]=e=>s.deleteQuestion()),onHidden:t[4]||(t[4]=e=>s.hideDelete())},{default:(0,a.w5)((()=>[Q])),_:1},8,["modelValue"]),(0,a.Wm)(r,{id:"edit-modal",modelValue:o.editModal,"onUpdate:modelValue":t[10]||(t[10]=e=>o.editModal=e),title:"Editar pergunta",onOk:t[11]||(t[11]=e=>s.updateQuestion()),onHidden:t[12]||(t[12]=e=>s.resetQuestion())},{default:(0,a.w5)((()=>[(0,a.Wm)(w,{fluid:""},{default:(0,a.w5)((()=>[(0,a.Wm)(f,{autocomplete:"off"},{default:(0,a.w5)((()=>[(0,a.Wm)(m,{label:"Enunciado / Pergunta","label-for":"input-question"},{default:(0,a.w5)((()=>[(0,a.Wm)(d,{id:"input-question",modelValue:o.editQues.question,"onUpdate:modelValue":t[5]||(t[5]=e=>o.editQues.question=e),rows:"6",required:""},null,8,["modelValue"])])),_:1}),(0,a.Wm)(m,{label:"Respostas","label-for":"input-answer0"},{default:(0,a.w5)((()=>[(0,a.Wm)(p,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),q])),_:1}),(0,a.Wm)(c,{id:"input-answer0",modelValue:o.editQues.answers[0],"onUpdate:modelValue":t[6]||(t[6]=e=>o.editQues.answers[0]=e),required:""},null,8,["modelValue"]),k,(0,a.Wm)(p,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),W])),_:1}),(0,a.Wm)(c,{id:"input-answer1",modelValue:o.editQues.answers[1],"onUpdate:modelValue":t[7]||(t[7]=e=>o.editQues.answers[1]=e),required:""},null,8,["modelValue"]),V,(0,a.Wm)(p,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),U])),_:1}),(0,a.Wm)(c,{id:"input-answer2",modelValue:o.editQues.answers[2],"onUpdate:modelValue":t[8]||(t[8]=e=>o.editQues.answers[2]=e)},null,8,["modelValue"]),y,(0,a.Wm)(p,null,{default:(0,a.w5)((()=>[(0,a.Uk)("Resposta "),M])),_:1}),(0,a.Wm)(c,{id:"input-answer3",modelValue:o.editQues.answers[3],"onUpdate:modelValue":t[9]||(t[9]=e=>o.editQues.answers[3]=e)},null,8,["modelValue"])])),_:1})])),_:1})])),_:1})])),_:1},8,["modelValue"])],64)}var j={name:"QuestionBlock",props:{ques:Object},data(){return{removeModal:!1,editModal:!1,editQues:this.copyQuesProp()}},emits:["delete-question","update-question"],methods:{copyQuesProp(){let e={};return Object.assign(e,this.ques),e.answers={...this.ques.answers},e},hideDelete(){this.removeModal=!1},deleteQuestion(){this.removeModal=!1,this.$emit("delete-question",{id:this.$.vnode.key})},editQuestion(){this.editModal=!0},updateQuestion(){this.editModal=!1;let e={id:this.$.vnode.key,question:this.editQues};this.$emit("update-question",e)},resetQuestion(){this.editModal=!1,this.editQues=this.copyQuesProp()}}},C=n(89);const P=(0,C.Z)(j,[["render",O],["__scopeId","data-v-97560280"]]);var R=P,x=n(70),T=x.Z.create({baseURL:"http://localhost:3000",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=utf-8"}}),D={name:"App",components:{QuestionBlock:R},data:()=>({questions:[],lang:"pt",newQues:{question:"",answers:[]},newModal:!1}),mounted:async function(){this.loadQuestions()},methods:{loadQuestions(){T.get("/get/"+this.lang).then((e=>{this.questions=[],Object.assign(this.questions,e.data)}))},deleteQuestion(e){this.questions.splice(e.id,1),this.saveToFile()},updateQuestion(e){this.questions[e.id]=e.question,this.saveToFile()},insertNewQuestion(){this.newModal=!1;let e={};Object.assign(e,this.newQues),e.question&&e.answers.length>=2?(this.questions.push(e),this.saveToFile()):console.log("Pergunta mal formada!"),this.newQues={question:"",answers:[]}},changeLanguage(e){this.lang=e,this.loadQuestions(),console.log("Language changed to: "+e)},saveToFile(){T.post("/update/"+this.lang,this.questions)}}};const z=(0,C.Z)(D,[["render",h]]);var E=z;(0,u.ri)(E).use(o.ZP).mount("#app")}},t={};function n(u){var o=t[u];if(void 0!==o)return o.exports;var a=t[u]={exports:{}};return e[u](a,a.exports,n),a.exports}n.m=e,function(){var e=[];n.O=function(t,u,o,a){if(!u){var l=1/0;for(d=0;d<e.length;d++){u=e[d][0],o=e[d][1],a=e[d][2];for(var s=!0,i=0;i<u.length;i++)(!1&a||l>=a)&&Object.keys(n.O).every((function(e){return n.O[e](u[i])}))?u.splice(i--,1):(s=!1,a<l&&(l=a));if(s){e.splice(d--,1);var r=o();void 0!==r&&(t=r)}}return t}a=a||0;for(var d=e.length;d>0&&e[d-1][2]>a;d--)e[d]=e[d-1];e[d]=[u,o,a]}}(),function(){n.n=function(e){var t=e&&e.__esModule?function(){return e["default"]}:function(){return e};return n.d(t,{a:t}),t}}(),function(){n.d=function(e,t){for(var u in t)n.o(t,u)&&!n.o(e,u)&&Object.defineProperty(e,u,{enumerable:!0,get:t[u]})}}(),function(){n.g=function(){if("object"===typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"===typeof window)return window}}()}(),function(){n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)}}(),function(){n.r=function(e){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}}(),function(){var e={143:0};n.O.j=function(t){return 0===e[t]};var t=function(t,u){var o,a,l=u[0],s=u[1],i=u[2],r=0;if(l.some((function(t){return 0!==e[t]}))){for(o in s)n.o(s,o)&&(n.m[o]=s[o]);if(i)var d=i(n)}for(t&&t(u);r<l.length;r++)a=l[r],n.o(e,a)&&e[a]&&e[a][0](),e[a]=0;return n.O(d)},u=self["webpackChunkquiz_manager"]=self["webpackChunkquiz_manager"]||[];u.forEach(t.bind(null,0)),u.push=t.bind(null,u.push.bind(u))}();var u=n.O(void 0,[998],(function(){return n(8106)}));u=n.O(u)})();
//# sourceMappingURL=app.bf8a5727.js.map
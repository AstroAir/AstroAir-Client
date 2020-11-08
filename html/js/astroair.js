/*
	astroair.js
	
	* 这是AstroAir客户端的JS代码
	* 主要由Max编写
	* 第一次修改日期 2020年9月25日
	* 第二次修改日期 2020年9月30日
	* 第三次修改日期 2020年10月5日
	* 第四次修改日期 2020年10月12日
	* 第四次修改日期 2020年10月13日

	
	*变更记录
	* v1.0.0
	* 初始化版本,首次将JS代码从HTML中分离
	* v1.0.1
	* 增加roboClip，remoteCamera相关函数
	* v1.0.2
	* 增加mount，focus，filter相关函数
	* 增加大量注释
*/
		//-----------自动加载--------------
		
		var ready=callback=>{		//当网页加载完成后执行
			"loading"!=document.readyState?callback():document.addEventListener("DOMContentLoaded",callback)
		};
		
		ready(()=>{		//网页自动加载
			setInitialBntInactive(),		//设置按钮无法点击
			initSeqCharts(),		//初始化拍摄进度
			writeVersion(),		//写入版本号
			closeMiniMenu(),		//关闭左侧菜单
			getLocalStorageIp(),		//获取本地存储的IP地址
			windowWidth=document.documentElement.clientWidth,		//获取客户端的网页宽度
			resetFocusGraph(),		//重置对焦图像
			resetImageGraph(),		//重置图像信息图像
			resetTempGraph(),		//重置温度图像
			resetGuideGraph(),		//重置导星图像
			initYScaleGuideChart(),		//初始化导星图像Y轴
			setInitialBtnActive(),		//设置可以点击的按钮
			$(window).trigger("resize"),		//通过jquery触发window resize事件
			$(".alert").hide(),		//隐藏警告
			$((function(){$('[data-toggle="tooltip"]').tooltip()})),		//提示框	
			loadImg64("background.jpeg",1000,600),		//默认加载Background.jpg
			//download("https://astroair.cn/version.txt"),		//自动更新
			document.getElementById("connectBtn").addEventListener("click",startconn)		//监听按钮
		});
		
		//-----------定义参数------------
		
		const version="2.0.0",minAirVersion="2.0.0";		//版本号
		var IDcounter=0;
		var uidList={};
		var internetconnected=!1,		//网络连接，1为已连接到网络
			imgShooting=!1,		//拍摄，1为正在拍摄
			tempUIDshot,
			tempUIDsearch,
			startupConnected=!1,	//连接设备，1为已经连接	
			btnToInitActivate=["#connectBtn",".modal-voy-btn",".reset-btn",".menuBtn"],		//初始化按钮
			lev1Btns=[".lev1active"],
			focuserPosition,		//电调当前位置
			focuserTemp,		//电调温度
			simulatorMode=!1,		//模拟模式，暂不支持
			simbadPointer=!1,
			blindsolve=!1,
			cameraStatus,		//相机状况
			actualCameraFilter,
			cameraFilterList=[],		//滤镜轮列表
			airIsRunning=!1,		//air状态
			actionToConfirm="",
			btnTempActive=[],
			imageStats=[],		//图像状态
			focusStats=[],		//电调状态
			windowWidth=0,		//网页宽度
			remoteLogLevel=0,
			genStatusText="",
			logoanimationaccepted,
			runSeq="",
			runDs="",
			fovdata={},
			actualCcdData={},
			connectedCcdData={},		//已连接相机数据
			connectedProfileName,		//已连接文件名称
			sameFov=!0,
			multiFov={Virtual_Fov_Default:{DX:3358,DY:2536,PixelSize:5.4,PA:0,Focallen:530}},		//默认虚拟视场设置
			mosaicSettings={Wnum:1,Hnum:1,Overlap:15,angleAdj:!1},
			mosaicTiles=[],
			actualProfileName="",		//真实配置文件名称
			tempRaRec,		//赤道仪RA
			tempDecRec,		//赤道仪DEC
			roboClipGroup=[],
			roboClipTemp=[],
			roboClipOrder=0,
			roboClipNameTxt="",
			roboClipGroupTxt="",
			roboClipNoteTxt="",
			rcFilterSelected=!1,
			mountConnected=!1,		//赤道仪连接情况，1为连接
			ccdConnected=!1,		//相机连接情况，1为连接
			ccdCoolerOn=!1,			//相机制冷情况，1为连接
			planConnected=!1,		//计划拍摄连接情况，1为连接
			plateSolveConnected=!1,		//Astrometry连接情况，1为连接
			guideConnected=!1,		//PHD2连接情况，1为连接
			autofocusConnected=!1,		//自动对焦连接情况，1为连接
			mountTracking=!1,		//赤道仪跟踪，1为正在跟踪
			mountParked=!1,		//赤道仪归位，1为已经归位
			mountFlip=0,
			mountSlew=!1,		//赤道仪旋转，1为正在旋转
			ccdStatus=0,		//相机信息
			connected=!1,		//服务器连接情况，1为已经连接
			websocket,		//WebSocket
			pollingJSON,		//Json数组
			pollingInterval=5,
			str_end="\r\n",		//文本的结尾
			wsUri,			//WebSkocet加密类型，暂时不支持wss
			tcpPort,		//TCP端口，默认为5950
			heartBeat,
			HostJ,
			InstJ,
			airVer;		//AstroAir服务器版本

		var totTempPointData=300,		//最大温度
			totGuidePointData=90,		//最大导星误差
			YscaleGuideChart=2,		//范围
			YscaleValues=[.5,1,2,3,4,6],		//y轴的参数
			prevXguide,prevYguide;		//x轴,y轴

		var signalCodes={
			1:"服务器正在运行 - 自动对焦错误",
			2:"服务器正在运行 - 拍摄队列为空",
			3:"服务器正在运行 - SC ARRAY Autofocus all nodes",
			4:"服务器正在运行 - Precise Pointing",
			5:"服务器正在运行 - 自动对焦",
			6:"服务器正在运行 - SC ARRAY AutoFlat single node",
			7:"服务器正在运行 - SC ARRAY Autofocus single node",
			8:"服务器正在运行 - SC ARRAY Connect Setup all nodes",
			9:"服务器正在运行 - SC ARRAY Disconnect Setup all nodes",
			10:"服务器正在运行 - SC ARRAY Filter Change single node",
			11:"服务器正在运行 - SC ARRAY Get Actual Filter single node",
			12:"服务器正在运行 - SC ARRAY Focuser Move To single node",
			13:"服务器正在运行 - SC ARRAY Focuser Offset single node",
			14:"服务器正在运行 - SC ARRAY Rotator Move single node",
			15:"服务器正在运行 - 建立连接",
			16:"服务器正在运行 - 断开连接",
			18:"服务器正在运行 - 相机拍摄",
			19:"服务器正在运行 - 相机正在制冷",
			20:"服务器正在运行 - 电调移动至",
			21:"服务器正在运行 - 电动调焦座移动至",
			22:"服务器正在运行 - 转换器旋转至",
			23:"服务器正在运行 - 自动平场",
			24:"服务器正在运行 - 滤镜轮转动至",
			25:"服务器正在运行 - 解析的真实位置",
			26:"服务器正在运行 - SC ARRAY Sequence",
			27:"服务器正在运行 – SC ARRAY Create Directory on FileSystem single node",
			28:"服务器正在运行 – SC ARRAY CCD Cooling single node",
			29:"服务器正在运行 - SC ARRAY Get CCD Temperature single node",
			30:"服务器正在运行 - SC ARRAY Camera Shot single node",
			31:"服务器正在运行 - 赤道仪Goto",
			32:"服务器正在运行 - 正在运行脚本",
			33:"服务器正在运行 - SC ARRAY AutoFocus all node with LocalField method",
			34:"服务器正在运行 - SC ARRAY AutoFocus single node with LocalField method",
			500:"AstroAir状态 - 错误",
			501:"AstroAir状态 - 等待 (已完成所有任务)",
			502:"AstroAir状态 - 开始运行",
			503:"AstroAir状态 - 停止运行",
			504:"AstroAir状态 - 初始化",
			505:"AstroAir状态 - 警告",
			506:"AstroAir状态 - 未知请求"
		},
		actionResultCodes={
			0:"NEED INIT Wait to Running",
			1:"READY Ready to Running",
			2:"RUNNING Running",
			3:"PAUSE Paused",
			4:"OK Finished",
			5:"FINISHED ERROR Finished with Error",
			6:"ABORTING Abort request waiting during running",
			7:"ABORTED Finished aborted",
			8:"TIMEOUT Finished timeout",
			9:"TIME END Finished for timer end",
			10:"OK PARTIAL FInished with some task not executed"
		},
		airStatusCodes={
			0:"已停止-AstroAir未与安装程序连接某些操作无法工作",
			1:"空闲-AstroAir可以运行行动，实际上是在空闲",
			2:"运行-AstroAir正在运行一个操作",
			3:"错误-AstroAir处于空闲状态，但上一个操作已完成，但出现错误",
			4:"未定义-无法确定AstroAir的状态",
			5:"警告-AstroAir号处于空闲状态，但最后一次操作结束时出现警告"
		},
		shotStatusCodes={
			0:"IDLE - No Exposure",
			1:"EXPOSE - Exposing",
			2:"DOWNLOAD - Download running from camera to PC",
			3:"WAIT_JPG - Process to create a JPG for preview",
			4:"ERROR - Camera Error, shot is aborted"
		},
		coolerStat={
			0:"INIT AstroAir application is initializing then Camera Control",
			1:"UNDEF Status not recognized",
			2:"NO COOLER No cooler for this camera",
			3:"OFF Cooler Off",
			4:"COOLING Cooling running",
			5:"COOLED Cooled",
			6:"TIMEOUT COOLING",
			7:"WARMUP RUNNING Warmup Running",
			8:"WARMUP END Warmup Finished",
			9:"ERROR"
		},
		logType={
			1:"DEBUG",
			2:"INFO",
			3:"WARNING",
			4:"CRITICAL",
			5:"TITLE",
			6:"SUBTITLE",
			7:"EVENT",
			8:"REQUEST",
			9:"EMERGENCY"
		},
		logColors={
			1:"silver-log",
			2:"lime-log",
			3:"gold-log",
			4:"lightcoral-log",
			5:"gray-log",
			6:"lightskyblue-log",
			7:"violet-log",
			8:"aquamarine-log",
			9:"orange-log"
		};
		var events={		//事件类型
			0:"Version",
			1:"Polling",
			2:"Signal",
			3:"NewFITReady",
			4:"NewJPGReady",
			5:"ShutDown",
			6:"RemoteActionResult",
			7:"ArrayElementData",
			8:"ControlData",
			9:"ShotRunning",
			10:"LogEvent",
			11:"AutoFocusResult",
			12:"ProfileChanged"
		};
		
		jQuery("img.svg").each((function(){		//SVG图像设置
			var $img=jQuery(this),
				imgID=$img.attr("id"),
				imgClass=$img.attr("class"),
				imgURL=$img.attr("src");
			jQuery.get(imgURL,(function(data){
				var $svg=jQuery(data).find("svg");
				void 0!==imgID&&($svg=$svg.attr("id",imgID)),
				void 0!==imgClass&&($svg=$svg.attr("class",imgClass+" replaced-svg")),
				$svg=$svg.removeAttr("xmlns:a"),
				$img.replaceWith($svg)
			}),"xml")
		}));

		//---------版本-----------
		
		function writeVersion(){		//写入版本号
			$("#dashVer").text(version)
		}
		
		function versionNotSupported(minAirVersion,actAirVer){		//版本不支持
			var cleanActVersion,numericActualVersion,numericMinVer,result;
			return transformVersionNumber(actAirVer.substring(7,actAirVer.indexOf("-")))<transformVersionNumber(minAirVersion)
		}
		
		function transformVersionNumber(number){		//整理版本号
			var numArray=number.split("."),result;
			return numArray[0]*=1e6,numArray[1]*=1e3,numArray[2]=1*numArray[2].replace(/\D/g,""),numArray.reduce((a,b)=>a+b,0)
		}

		//----------WebSocket----------
		
		function connect(){		//连接websocket
			var inputField=document.getElementById("ipAddress"),urlpart=extractHostname(inputField.value);
			inputField.value=urlpart,tcpPort=getTcpPort();
			let ws_protocol="ws://";		//ws为不加密
			"localhost"===urlpart?(wsUri=ws_protocol+urlpart.toString()+":"+tcpPort,createWebSocket()):""===urlpart?(wsUri=ws_protocol+"localhost:"+tcpPort,createWebSocket()):(wsUri=ws_protocol+urlpart.toString()+":"+tcpPort,createWebSocket()),saveLocalStorage(inputField.value)
		}
		
		function getTcpPort(){		//获取TCP端口号
			let portSelect=document.getElementById("ipPort"),tcpPort;
			return portSelect.options[portSelect.selectedIndex].value
		}
		
		function saveLocalStorage(ip){		//将获取的IP地址存储在本地
			""!=ip&&localStorage.setItem("host",ip)
		}
		
		function extractHostname(url){		//判断输入的IP地址是否合法
			var hostname;
			return hostname=(hostname=(hostname=url.indexOf("//")>-1?url.split("/")[2]:url.split("/")[0]).split(":")[0]).split("?")[0]
		}

		function createWebSocket(){		//创建WebSocket连接
			(websocket=new WebSocket(wsUri)).onopen=function(evt){onOpen(evt)},
			websocket.onclose=function(evt){onClose(evt)},		//关闭WebSocket
			websocket.onmessage=function(evt){onMessage(evt)},		//监听WebSocket
			websocket.onerror=function(evt){onError(evt)},		//接收错误信息
			connectingFire()
		}
		
		getWs_protocol=()=>{		//获取使用协议类型
				let checkBox,wssProt;
				return document.getElementById("wssCheck").checked?"wss://":"ws://"		//目前只支持ws
		},
	
		checkParamWssSwitch=()=>{		//判断是否可以使用wss，目前只支持ws
			let tmpParam=getUrlParam("ssl"),checkBox=document.getElementById("wssCheck");
			checkBox.checked=1==tmpParam
		}
		
		function onMessage(Event){		//接收JSON信息
			try{
				var JSONobj=JSON.parse(Event.data.replace(/\bNaN\b/g,"null"))		//拆分JSON
			}
			catch(e){
				errorFire(e,"JSON格式错误")		//返回错误信息
			}
			"Polling"!==JSONobj.Event&&readJson(JSONobj)		//如果JSON中的Event部位Polling，则自动跳转到readJson
		}
		
		function readJson(msg){		//接受JSON信息
			var num = 100;
			for(var a = 0;a < 13;a++)
				if(msg.Event == events[a]){		//判断事件类型
					num = a;		//赋值
					break;
				}
			switch(num){		//处理对应事件
				case 0:
					VersionRec(msg);		//版本号
					break;
				case 1:		//Polling确认是否连接
					break;
				case 2:
					signalReceived(msg.Code);
					break;
				case 3:
					newFitReadyReceived(msg);		//新的Fits图像加载完成
					break;
				case 4:
					newJPGReadyReceived(msg);		//新的JPG图像加载完成
					break;
				case 5:break;		//关机
				case 6:
					remoteActionResultReceived(msg);		//获取命令类型并作出判断
					break;
				case 7:
					arrayElementDataReceived(msg);
					break;
				case 8:
					controlDataReceived(msg);		//控制信息接收
					break;
				case 9:
					shotRunningReceived(msg);		//拍摄情况接收
					break;
				case 10:
					logEventReceived(msg);		//日志事件接收
					break;
				case 11:
					autoFocusResultReceived(msg);		//自动对焦结果接收
					break;
				case 12:
					profileChangedReceived(msg);		//配置文件变化情况接收
					break;
				default:text="No value found"		//不属于任何事件，返回错误
			}"error"in msg&&errorFire(msg.error.message+" - id:"+msg.id)		//如果有错误信息则显示错误信息
		}
		
		function remoteActionResultReceived(msg){		//获取命令类型并作出判断
			//var resultText=actionResultCodes[msg.ActionResultInt],name=uidList[msg.UID];
			var resultText=actionResultCodes[msg.ActionResultInt],name=msg.UID;
			//连接
			"RemoteSetupConnect"===name&&4===msg.ActionResultInt&&remoteSetupConnected(),		//建立连接
			"RemoteSetupConnect"===name&&5===msg.ActionResultInt&&remoteSetupError(name,resultText),		//连接错误
			"RemoteSetupConnect"===name&&8===msg.ActionResultInt&&remoteSetupTimedOut(),		//连接超时
			"RemoteSetupDisconnect"===name&&4===msg.ActionResultInt&&remoteSetupDisconnected(),		//断开连接
			//相机
			"RemoteCameraShot"===name&&4===msg.ActionResultInt&&remoteCameraShotOk(),		//相机拍摄完成
			"RemoteCameraShot"===name&&5===msg.ActionResultInt&&remoteCameraShotError(resultText),		//相机拍摄错误
			"RemoteCameraShot"===name&&6===msg.ActionResultInt&&remoteCameraShotAborting(),		//暂停相机拍摄
			"RemoteCameraShot"===name&&7===msg.ActionResultInt&&remoteCameraShotAborted(),		//相机拍摄已停止
			//滤镜轮
			"RemoteGetFilterConfiguration"===name&&4===msg.ActionResultInt&&getFilterConfigurationReceived(msg),		//获取滤镜轮设置
			"RemoteFilterGetActual"===name&&4===msg.ActionResultInt&&updateFilterActual(msg.ParamRet),		//获取滤镜轮真实设置
			"RemoteFilterChangeTo"===name&&4===msg.ActionResultInt&&getActualFilter(),		//改变滤镜轮位置
			//目标搜索
			"RemoteSearchTarget"===name&&4===msg.ActionResultInt&&remoteSearchReceived(msg.ParamRet),		//接收目标搜索结果
			"RemoteSearchTarget"===name&&5===msg.ActionResultInt&&remoteSearchReceivedFinishedError(msg.Motivo),		//目标搜索错误
			//获取设备信息
			"RemoteGetEnvironmentData"===name&&4===msg.ActionResultInt&&remoteEnvironmentDataReceived(msg.ParamRet),		
			"RemoteGetEnvironmentData"===name&&4!==msg.ActionResultInt&&errorFire("获取设备信息出现错误："+msg.Motivo,"服务器错误!"),
			//配置文件
			"getProfileName"===name&&4===msg.ActionResultInt&&getProfileNameReceived(msg.ParamRet),
			"getProfileName"===name&&4!==msg.ActionResultInt&&errorFire("获取配置文件出现错误: "+msg.Motivo,"服务器错误!"),
			"RemoteSetLogEvent"===name&&4===msg.ActionResultInt&&remoteSetLogEventReceived(),
			//仪表盘模式
			"RemoteSetDashboardMode"===name&&4===msg.ActionResultInt&&remoteSetDashBoardModeOk(),
			"RemoteSetDashboardMode"===name&&4!==msg.ActionResultInt&&errorFire("设置仪表盘模式出现错误: "+msg.Motivo,"服务器错误!"),
			//搜索目标
			"RemotePrecisePointTarget"===name&&4===msg.ActionResultInt&&remotePrecisePointTargetOk(),
			"RemotePrecisePointTarget"===name&&5===msg.ActionResultInt&&remotePrecisePointTargetError(msg.Motivo),
			
			"RemoteGetListAvalaibleSequence"===name&&4===msg.ActionResultInt&&getSequenceListReceivedOk(msg.ParamRet.list),
			"RemoteGetListAvalaibleSequence"===name&&5===msg.ActionResultInt&&getSequenceListReceivedError(msg.Motivo),
			"RemoteGetListAvalaibleDragScript"===name&&4===msg.ActionResultInt&&getDsListReceivedOk(msg.ParamRet.list),
			"RemoteGetListAvalaibleDragScript"===name&&5===msg.ActionResultInt&&getDsListReceivedError(msg.Motivo),
			//相机参数
			"RemoteGetCCDSizeInfoEx"===name&&4===msg.ActionResultInt&&RemoteGetCCDSizeInfoReceived(msg.ParamRet),
			"RemoteGetCCDSizeInfoEx"===name&&5===msg.ActionResultInt&&RemoteGetCCDSizeInfoError(msg.Motivo+" da GetCCDSize"),
			//赤道仪
			"RemoteMountFastCommand"===name&&4===msg.ActionResultInt?remoteMountFastCommandreceived():"RemoteMountFastCommand"===name&&4!=msg.ActionResultInt&&remoteMountFastCommandError(msg.Motivo,msg.ActionResultInt),
			"sendRemoteSolveAndSync"===name&&4===msg.ActionResultInt?sendRemoteSolveAndSyncReceived(msg.ParamRet):"sendRemoteSolveAndSync"===name&&4!=msg.ActionResultInt&&remoteSolveAndSyncError(msg.Motivo,msg.ActionResultInt),
			"sendRemoteSolveNoSync"===name&&4===msg.ActionResultInt?sendRemoteSolveNoSyncReceived(msg.ParamRet):"sendRemoteSolveNoSync"===name&&4!=msg.ActionResultInt&&remoteSolveAndSyncError(msg.Motivo,msg.ActionResultInt),
			"sendRemoteSolveFov"===name&&4===msg.ActionResultInt?sendRemoteSolveFovReceived(msg.ParamRet):"sendRemoteSolveFov"===name&&4!=msg.ActionResultInt&&remoteSolveAndSyncError(msg.Motivo,msg.ActionResultInt),
			//目标管理器
			"RemoteRoboClipGetTargetList"===name&&4===msg.ActionResultInt?RemoteRoboClipGetTargetListReceived(msg.ParamRet):"RemoteRoboClipGetTargetList"===name&4!=msg.ActionResultInt&&RemoteRoboClipGetTargetListReceivedError(msg.Motivo,msg.ActionResultInt),
			"RemoteRoboClipRemoveTarget"===name&&4===msg.ActionResultInt?remoteRoboClipRemoveTargetOkReceived(msg.ParamRet):"RemoteRoboClipRemoveTarget"===name&4!=msg.ActionResultInt&&remoteRoboClipRemoveTargetReceivedError(msg.Motivo,msg.ActionResultInt),
			"RemoteRoboClipUpdateTarget"===name&&4===msg.ActionResultInt?remoteRoboClipUpdateTargetOkReceived(msg.ParamRet):"RemoteRoboClipUpdateTarget"===name&4!=msg.ActionResultInt&&remoteRoboClipUpdateTargetReceivedError(msg.Motivo,msg.ActionResultInt),
			"RemoteRoboClipAddTarget"===name&&4===msg.ActionResultInt?remoteRoboClipAddTargetOkReceived(msg.ParamRet):"RemoteRoboClipAddTarget"===name&4!=msg.ActionResultInt&&remoteRoboClipAddTargetReceivedError(msg.Motivo,msg.ActionResultInt),
			//对焦
			"RemoteFocus"===name&&4===msg.ActionResultInt?remoteFocusReceivedOK(msg.ParamRet):"RemoteFocus"===name&4!=msg.ActionResultInt&&remoteFocusReceivedError(msg.Motivo,resultText),
			"RemoteFocuserMoveTo"===name&&4===msg.ActionResultInt?remoteFocuserMoveReceivedOK(msg.ParamRet):"RemoteFocuserMoveTo"===name&4!=msg.ActionResultInt&&remoteFocuserMoveReceivedError(msg.Motivo,resultText),
			"RemoteFocusInject"===name&&4===msg.ActionResultInt?RemoteFocusInjectReceivedOK(msg.ParamRet):"RemoteFocusInject"===name&4!=msg.ActionResultInt&&RemoteFocusInjectReceivedError(msg.Motivo,resultText),
			//获取配置文件
			"RemoteGetAstroAirProfiles"===name&&4===msg.ActionResultInt?remoteGetAstroAirProfilesReceived(msg.ParamRet):"RemoteGetAstroAirProfiles"===name&4!=msg.ActionResultInt&&remoteGetAstroAirProfilesReceivedError(msg.Motivo,resultText),
			"RemoteGetAstroAirProfilesstartup"===name&&4===msg.ActionResultInt?remoteAstroAirProfileStartupReceived(msg.ParamRet):"RemoteGetAstroAirProfilesstartup"===name&4!=msg.ActionResultInt&&remoteGetAstroAirProfilesReceivedError(msg.Motivo,resultText),
			"RemoteSetProfile"===name&&4===msg.ActionResultInt?remoteSetProfileReceived(msg.ParamRet):"RemoteSetProfile"===name&4!=msg.ActionResultInt&&remoteSetProfileReceivedError(msg.Motivo,resultText),
			removeUid(msg.UID)
		}
		
		function removeUid(Uid){
			delete uidList[Uid],callBack(Uid)
		}
		
		function callBack(Uid){}

		function errorFire(message,title){		//错误提示
			""==title&&(title="错误信息!"),
			""==message&&(message="未知错误. 请检查设备连接?"),
			$("#errorMessage").html(message),
			$("#errorModalTitle").html(title),
			$("#centralModalDanger").modal("show")
		}
		
		function connectingFire(message){		//连接错误显示
			$("#centralModalConnecting").modal("show"),
			""!=message&&$("#infoMessage").html(message)
		}
		
		function onOpen(evt){		//打开端口
			connectingHide(),		//隐藏连接状态栏
			connected=!0,		//已经连接
			changeButtonStatus(),		//改变按钮状态
			setBtnActive(".lev1active"),
			document.getElementById("disconnectBtn").addEventListener("click",closeconn),		//增加按钮监听
			writeToLog(getTimeNow()+" &emsp;<span class='logMsgType text-white'>[ DSHB ]</span> &emsp; AstroAir服务器连接成功"),
			sendRemoteDashboardMode()		//发送仪表盘模式
		}
		
		function sendMessage(){		//发送消息
			var msgLoc=document.getElementById("message").value;
			connected?0==msgLoc.length?errorFire("请输入JSON字符串..."):doSend(msgLoc):connected||errorFire("发送信息错误,是否连接到服务器?")
		}
		
		function onClose(event){		//关闭端口
			connected&&(writeToLog(getTimeNow()+" &emsp;<span class='logMsgType text-white'>[ DSHB ]</span> &emsp; AstroAir服务器断开连接"),
				connected=!1,		//已经断开连接
				clearInterval(heartBeat),
				setStatusLedOff("connStatus"),		//熄灭连接指示灯
				setInitialBntInactive(),
				$("#voyver").text("AstroAir服务器连接情况"),
				changeButtonStatus(),		//改变按钮属性
				resetInterfaceOnRun()		//重置正在运行脚本的界面
			)
		}
		
		function connectingHide(){		//隐藏链接信息
			setTimeout((function(){
				$("#centralModalConnecting").modal("hide")
			}),600)
		}

		function sendRemoteDashboardMode(){			//发送仪表盘模式
			var Req={method:"RemoteSetDashboardMode",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsOn=!0,Req.id=generateID(),
			pushUid("RemoteSetDashboardMode",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function remoteSetDashBoardModeOk(){
			remoteSetLogEventReq()
		}
		
		function remoteSetLogEventReq(){
			var Req={method:"RemoteSetLogEvent",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsOn=!0,
			Req.params.Level=remoteLogLevel,
			Req.id=generateID(),
			pushUid("RemoteSetLogEvent",Req.params.UID),
			doSend(JSON.stringify(Req))
		}

		function getLocalStorageIp(){		//从本地读取IP地址
			var ip=localStorage.getItem("host");
			document.getElementById("ipAddress").value=ip,checkParamPort()
		}
		
		function getUrlParam(paramName){		//输入端口号
			var result=null,tmp=[];
			return location.search.substr(1).split("&").forEach((function(item){
				(tmp=item.split("="))[0]===paramName&&(result=decodeURIComponent(tmp[1]))
			})),
			result
		}
		
		function checkParamPort(){		//判断端口号输入是否合法
			let tmpParam=getUrlParam("port"),portSelect=document.getElementById("ipPort");
			if(tmpParam&&"undefined"!=tmpParam){
				var opt=document.createElement("option");
				opt.appendChild(document.createTextNode(tmpParam)),
				opt.value=tmpParam,portSelect.appendChild(opt),
				portSelect.value=tmpParam
			}
		}
		
		function generateID(){		//生成ID
			return IDcounter<=1e4?IDcounter++:IDcounter=1,IDcounter
		}
		
		function generateUID(){		//加密所生成的ID
			var result="",i,j;
			for(j=0;j<32;j++)
				8!=j&&12!=j&&16!=j&&20!=j||(result+="-"),
				result+=i=Math.floor(16*Math.random()).toString(16).toUpperCase();
			return result
		}
		
		function pushUid(name,Uid){
			uidList[Uid]=name
		}
		
		function startconn(){		//连接设备
			connected||connect()
		}

		function closeconn(){		//断连设备
			connected&&websocket.close()
		}
		
		function VersionRec(JSONobj){		//接受版本号
			InstJ!==JSONobj.Inst&&(InstJ=JSONobj.Inst),
			airVer!==JSONobj.AIRVersion&&(airVer=JSONobj.AIRVersion),
			versionNotSupported("2.0.0",airVer)&&errorFire("抱歉,您必须使用2.0.0版本以上的服务器 <strong>2.0.0</strong> (the minimum recommended version). <br> To take full advantage of all the features of the Dashboard we highly recommend updating AstroAir to the latest version available.<br><strong>If you continue with your version, the Dashboard may not work partially or totally.</strong>","AstroAir Version not Supported"),
			$("#voyver").text("AstroAir服务器已连接 - "+airVer),
			StartHeartBeat(pollingInterval),
			setStatusLedOn("connStatus"),
			setBtnActive("#startupConn, #profileListtBtn")
		}
		
		function StartHeartBeat(pollingInterval){
			heartBeat=setInterval(HeartBeat,1e3*pollingInterval)
		}
		
		function HeartBeat(){
			doSend(pollingGenMsg())
		}
		
		function pollingGenMsg(){		//获取控制信息
			var pollingJSONstr;
			return JSON.stringify({
				method:"Polling",
				Timestamp:(new Date).getTime()/1e3|0,
				Host:HostJ,
				Inst:InstJ
			})
		}

		function onError(event){		//接受错误信息
			connectingHide();		//隐藏正在连接界面
			var reason="连接错误: 服务器不可用.";
			writeToLog(getTimeNow()+" &emsp;<span class='logMsgType text-white'>[ DSHB ]</span> &emsp;"+reason),		//将错误信息写入日志
			errorFire(reason,"连接错误")		//显示错误信息
		}
		
		function setStatusLedOn(ledId){		//指示灯亮起
			document.getElementById(ledId).classList.add("ledgreen")
		}	
			
		function setStatusLedOff(ledId){		//指示灯熄灭
			document.getElementById(ledId).classList.remove("ledgreen")
		}		

		function resetGlobalvar(){		//重置全局变量
			imgShooting=!1,
			tempUIDshot="",
			tempUIDsearch="",
			startupConnected=!1,
			airIsRunning=!1,
			imageStats=[],
			cameraStatus="",
			mountConnected=!1,
			ccdConnected=!1,
			ccdCoolerOn=!1,
			planConnected=!1,
			guideConnected=!1,
			autofocusConnected=!1,
			mountTracking=!1,
			mountParked=!1,
			mountFlip=0
		}

		function doSend(message){		//发送信息
			var datatoSend=message+str_end;
			connected?websocket.send(datatoSend):errorFire("服务器未连接, 无法发送数据.","发送信息错误")		//检查WebSocket是否连接，如果没有连接则返回错误信息
		}

		function resetInterfaceOnRun(){		//重置正在运行的界面
			resetEnvironmentData(),		//重置设备信息
			resetShotPanel(),		//重置拍摄计划
			$(".imgStatItem").remove(),		//重置图像信息图像
			resetTempGraph(),		//重置温度图像
			resetGuideGraph(),		//重置导星图像
			resetGlobalvar(),		//重置全局变量
			$(".btn").css("pointer-events","auto"),
			$(".btn").addClass("disabled btn-dark"),		//按钮无法使用
			$(".statusLed").removeClass("ledgreen"),		//连接状态重置
			$(".blindSwitchInput").prop("checked",!1),
			$("body").css("cursor","default"),
			$("#startupConn").html("连接"),		// 重置链接按钮
			resetInfoDataItem(),		//重置数据信息
			hideStatusBar(),		//隐藏状态栏
			$("#seqRunli").addClass("d-none").removeClass("d-flex"),
			$("#dsRunli").addClass("d-none").removeClass("d-flex"),
			setInitialBtnActive()		//设置默认可用的按钮
		}
		
		function resetInfoDataItem(){
			var elements=document.querySelectorAll(".info-data-item:not(.text-muted)");
			elements.forEach((function(item){item.textContent=""})),
			elements.length=0
		}

		function resetEnvironmentData(){		//重置设备信息
			$(".env-element-li").remove(),
			$("#cont-seq-list").addClass("d-none"),
			$("#selectedSeq").text(""),
			$("#cont-ds-list").addClass("d-none"),
			$("#selectedDs").text("")
		}
		
		function resetShotPanel(){		//重置拍摄计划
			shotBtnReset(),
			setBtnNotActive("#remoteShotAbortbtn"),		//设置停止拍摄按钮无法点击
			$("#cameraStatus").text(""),
			resetShotInfo()		//重置拍摄信息
		}
		
		function resetShotInfo(){		//重置拍摄信息
			var shInField;
			document.querySelectorAll(".shInField").forEach(field=>{field.textContent=""})
		}

		function shotBtnReset(){		//重置拍摄按钮
			$("#remoteShotbtn").html('<i class="fas fa-camera mr-2"></i>拍摄').removeClass("disabled")
		}
		
		function setInitialBntInactive(){		//按钮无法使用
			$(".btn").addClass("disabled btn-dark")
		}
		
		function setInitialBtnActive(){		//设置按钮可以使用
			btnToInitActivate.forEach((function(item){
				setBtnActive(item)
			}))
		}	

		function changeButtonStatus(){		//改变按钮状态
			connected?(		//检测设备是否已经连接
				document.getElementById("connectBtn").classList.add("btn-success"),		//如果没有连接
				document.getElementById("connectBtn").innerHTML='<i class="fas fa-link fa-spin mr-1"></i>已连接',
				setBtnActive("#disconnectBtn"),
				setBtnActive(".btn"),
				setBtnActive("#sendBtn")
			):(
				document.getElementById("connectBtn").classList.remove("btn-success"),		//如果已经连接
				document.getElementById("connectBtn").innerHTML='<i class="fas fa-link mr-1"></i>连接',
				setBtnNotActive(".btn"),
				setBtnActive("#connectBtn")
			)
		}
		
		function setBtnActive(btnId){		//设置按钮可以点击
			$(btnId).removeClass("disabled btn-dark")
		}

		function setBtnNotActive(btnId){		//设置按钮无法点击
			$(btnId).addClass("disabled btn-dark")
		}
		
		//-----------图像信息图像-----------
		
		var imageStatChartCanvas=document.getElementById("imageStatChart"),
		dataimageStatChart={
			type:"line",
			labels:[".",".",".",".",".",".",".","."],
			display:0,
			datasets:[{
				label:"HFD",
				fill:!1,
				yAxisID:"HFD",
				lineTension:0,
				backgroundColor:"rgba(43,187,173,0.4)",
				borderColor:"#00C851",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderColor:"rgba(43,187,173,1)",
				pointBackgroundColor:"#fff",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(43,187,173,1)",
				pointHoverBorderColor:"rgba(43,187,173,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,
				data:[5,7,8,2,1,5,9,1]
			},{
				label:"StarIndex",
				fill:!1,
				yAxisID:"StarIndex",
				lineTension:0,
				backgroundColor:"rgba(51,181,229,0.4)",
				borderColor:"#33b5e5",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderColor:"rgba(51,181,229,1)",
				pointBackgroundColor:"#fff",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(51,181,229,1)",
				pointHoverBorderColor:"rgba(51,181,229,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,
				data:[3,2,1,7,2,3,1,5]
			}]
		},
		optionsImageChart={
			showLines:!0,
			animation:!1,
			legend:{display:!0},
			scales:{
				xAxes:[{display:!0}],
				yAxes:[{
					id:"HFD",
					display:!0,
					position:"right",
					ticks:{
						fontSize:8,
						beginAtZero:!0,
						fontColor:"#00C851",
						min:0,
						max:10
					}
				},{
					id:"StarIndex",
					display:!0,
					position:"right",
					ticks:{
						fontSize:8,
						beginAtZero:!0,
						fontColor:"#33b5e5",
						min:0,
						max:30
					}
				}]
			}
		},
		myImageChart=new Chart(imageStatChartCanvas,{		//更新图像信息图像
			type:"line",
			data:dataimageStatChart,
			options:optionsImageChart
		});
		
		function addDataImage(hfdData,StarIndexData){		//绘制图像信息图像
			var dataset1=dataimageStatChart.datasets[0].data,
				dataset2=dataimageStatChart.datasets[1].data;
				dataset1.splice(0,1),dataset1.push(hfdData),
				dataset2.splice(0,1),dataset2.push(StarIndexData),
				myImageChart.options.scales.yAxes[0].ticks.max=Math.ceil(percentage(Math.max(...dataset1),10)),myImageChart.options.scales.yAxes[1].ticks.max=Math.ceil(percentage(Math.max(...dataset2),10)),
			myImageChart.update()
		}
		
		function resetImageGraph(){		//重置图像信息图像
			for(dataimageStatChart.datasets[0].data=[],dataimageStatChart.datasets[1].data=[],dataimageStatChart.labels=[],$(".imgStatItem").remove(),i=0;i<8;i++)
				dataimageStatChart.datasets[0].data.push(0),
				dataimageStatChart.datasets[1].data.push(0),
				dataimageStatChart.labels.push(".");
			myImageChart.update()
		}

		//-----------温度图像-----------
		
		var tempChartCanvas=document.getElementById("tempChart")
		var dataTempchart={
			type:"line",
			labels:[],
			display:0,
			datasets:[{
				label:"Cooler Temp",
				fill:!1,
				yAxisID:"temperature",
				lineTension:0,
				backgroundColor:"rgba(75,192,192,0.4)",
				borderColor:"rgba(66,133,244,1)",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderColor:"rgba(75,192,192,1)",
				pointBackgroundColor:"#fff",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(75,192,192,1)",
				pointHoverBorderColor:"rgba(220,220,220,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,data:[]
			},{
				label:"Set Temp",
				fill:!1,
				yAxisID:"temperature",
				lineTension:0,
				backgroundColor:"rgba(75,192,192,0.4)",
				borderColor:"rgba(75,192,192,1)",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderColor:"rgba(75,192,192,1)",
				pointBackgroundColor:"#fff",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(75,192,192,1)",
				pointHoverBorderColor:"rgba(220,220,220,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,
				data:[]
			},{
				label:"Cooler Power",
				fill:"start",
				yAxisID:"power",
				lineTension:0,
				backgroundColor:"rgba(204,0,0,0.35)",
				borderColor:" rgba(204,0,0,1)",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(75,192,192,1)",
				pointHoverBorderColor:"rgba(220,220,220,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,
				data:[]
			}
		]};
		var optionsTempChart={
			showLines:!0,
			animation:!1,
			legend:{
				display:!1
			},
			scales:{
				xAxes:[{
					display:!1
				}],
				yAxes:[{
					id:"temperature",
					display:!0,
					position:"right",
					ticks:{
						fontSize:8,
						beginAtZero:!0,
						fontColor:"#4285f4",
						min:-50,
						max:50
					}
				},{
					id:"power",
					display:!0,
					ticks:{
						fontSize:8,
						beginAtZero:!0,
						fontColor:"#ff0000",
						min:0,
						max:100
					}}
				]
			}
		};
		var myTempChart=new Chart(tempChartCanvas,{		//更新温度图像
			type:"line",
			data:dataTempchart,
			options:optionsTempChart
		});
		
		function resetTempGraph(){		//重置温度图像
			for(dataTempchart.datasets[0].data=[],dataTempchart.datasets[1].data=[],dataTempchart.datasets[2].data=[],dataTempchart.labels=[],i=0;i<totTempPointData;i++)
				dataTempchart.datasets[0].data.push(0),
				dataTempchart.datasets[1].data.push(0),
				dataTempchart.datasets[2].data.push(0),
				dataTempchart.labels.push(0);
			myTempChart.update()
		}
		
		function addDataTemp(TEMP,POW,SETtemp){		//绘制温度图像
			var tempData=dataTempchart.datasets[0].data,
				setData=dataTempchart.datasets[1].data,
				powerData=dataTempchart.datasets[2].data;
			TEMP<1234&&TEMP>-1234&&(tempData.splice(0,1),
			tempData.push(TEMP)),
			POW<1234&&POW>-1234&&(powerData.splice(0,1),
			powerData.push(POW)),
			SETtemp<1234&&SETtemp>-1234&&(setData.splice(0,1),setData.push(SETtemp)),
			myTempChart.update()
		}
		
		//-----------对焦图像------------
		
		var focuserStatChartCanvas=document.getElementById("focusStatChart");
		var dataFocuserStatChart={
				type:"line",
				labels:[".",".",".",".",".",".",".",".",".","."],
				display:0,
				datasets:[{
					label:"HFD",
					fill:!1,
					yAxisID:"HFD",
					lineTension:0,
					backgroundColor:"rgba(43,187,173,0.4)",
					borderColor:"#CCC",
					borderCapStyle:"butt",
					borderDash:[],
					borderDashOffset:0,
					borderJoinStyle:"miter",
					pointBorderColor:"#ccc",
					pointBackgroundColor:["red","green","blue","red","red","red","white","red","green","blue"],
					pointBorderWidth:0,
					pointHoverRadius:5,
					pointHoverBackgroundColor:"#fff",
					pointHoverBorderColor:"#fff",
					pointHoverBorderWidth:2,
					pointRadius:5,
					pointHitRadius:5,
					data:[5,7,8,2,1,5,9,2,3,5]
				},{
					data:[]
				},{
					data:["R","G","B","R","R","R","L","R","G","B"]
				},{
					lineTension:.5,
					backgroundColor:"rgba(0,255,255,0.2)",
					borderColor:"rgba(0,255,255,0.3)",
					yAxisID:"Temp",
					fill:!0,
					pointRadius:0,
					data:["12","13","1","2","3","1","0","-5","0","2"]
				}]
			};
			var optionsFocuserChart={
				showLines:!0,
				animation:!1,
				beginAtZero:!0,
				legend:{display:!1},
				scales:{
					xAxes:[{display:!0}],
					yAxes:[{
						id:"HFD",
						display:!0,
						position:"right",
						ticks:{
							fontSize:8,
							beginAtZero:!0,
							fontColor:"#ccc",
							min:0,
							max:10
						}
					},{
						id:"Temp",
						display:!0,
						position:"right",
						ticks:{
							fontSize:8,
							beginAtZero:!0,
							fontColor:"#0ff",
							min:-20,
							max:20
						}
					}]
				},
				tooltips:{
					enabled:!0,
					bodyFontSize:10,
					custom:function(tooltip){
						tooltip.opacity>0||lightRowFilterOff()
					},
					callbacks:{
						title:function(tooltipItem,data){
							let val=data.datasets[0].data[tooltipItem[0].index],
							label=data.datasets[0].label+" "+val;
							if(0!==val){
								let index=tooltipItem[0].index,color=data.datasets[0].pointBackgroundColor[index];
								lightRowFilter(index,color)
							}
							return label
						},
						label:function(tooltipItem,data){
							let filterName=data.datasets[2].data[tooltipItem.index];
							return"NoFilter"==filterName?"":"Filter "+filterName
						},
						labelColor:function(tooltipItem,data){
							let filterColor=data.config.data.datasets[0].pointBackgroundColor[tooltipItem.index];
							return{borderColor:filterColor,backgroundColor:filterColor}
						}
					}
				}
			};
			myfocuserChart=new Chart(focuserStatChartCanvas,{		//更新对焦图像
				type:"line",
				data:dataFocuserStatChart,
				options:optionsFocuserChart
			});
		
		function addDataFocuser(hfdData,filterIndex,filterColor,temperature){		//绘制对焦曲线
			let hfdSet=dataFocuserStatChart.datasets[0].data,
			filterColorSet=dataFocuserStatChart.datasets[0].pointBackgroundColor,
			temperatureSet=dataFocuserStatChart.datasets[3].data,
			filterNameSet=dataFocuserStatChart.datasets[2].data,
			filterLabelColorSet=dataFocuserStatChart.datasets[1].data,
			filterName=getFilterNameFromIndex(filterIndex);
			hfdSet.splice(0,1),
			hfdSet.push(hfdData),
			filterColorSet.splice(0,1),
			filterColorSet.push(filterColor),
			filterLabelColorSet.splice(0,1),
			filterLabelColorSet.push(filterColor),
			filterNameSet.splice(0,1),
			filterNameSet.push(filterName),
			temperatureSet.splice(0,1),
			temperatureSet.push(temperature),
			myfocuserChart.options.scales.yAxes[0].ticks.max=Math.ceil(percentage(Math.max(...hfdSet),10)),
			myfocuserChart.options.scales.yAxes[1].ticks.max=Math.ceil(percentage(Math.max(...temperatureSet),10)+5),
			myfocuserChart.options.scales.yAxes[1].ticks.min=Math.ceil(percentage(Math.min(...temperatureSet),10)-5),
			myfocuserChart.update()
		}
		
		function resetFocusGraph(){		//重置对焦图像
			for(dataFocuserStatChart.datasets[0].data=[],dataFocuserStatChart.datasets[0].pointBackgroundColor=[],dataFocuserStatChart.datasets[1].data=[],dataFocuserStatChart.datasets[2].data=[],dataFocuserStatChart.datasets[3].data=[],focusStats=[],$(".focusStatItem").remove(),i=0;i<10;i++)
				dataFocuserStatChart.datasets[0].data.push(0),
				dataFocuserStatChart.datasets[0].pointBackgroundColor.push("#999999"),
				dataFocuserStatChart.datasets[2].data.push("NoFilter"),
				dataFocuserStatChart.datasets[3].data.push(0);
			myfocuserChart.update()
		}
		
		//----------导星图像-----------
		
		var guideChartCanvas=document.getElementById("guideChart");
		var	dataGuideChart={
			type:"line",
			labels:["Dec","Ra"],
			display:0,
			datasets:[{
				label:"Xcorr",
				fill:!1,
				yAxisID:"Xcorr",
				lineTension:0,
				backgroundColor:"rgba(75,192,192,0.4)",
				borderColor:"rgba(66,133,244,1)",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderColor:"rgba(75,192,192,1)",
				pointBackgroundColor:"#fff",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(75,192,192,1)",
				pointHoverBorderColor:"rgba(220,220,220,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,
				data:[]
			},{
				label:"Ycorr",
				fill:!1,
				yAxisID:"Ycorr",
				lineTension:0,
				backgroundColor:"rgba(75,192,192,0.4)",
				borderColor:"#ff0000",
				borderCapStyle:"butt",
				borderDash:[],
				borderDashOffset:0,
				borderJoinStyle:"miter",
				pointBorderColor:"rgba(75,192,192,1)",
				pointBackgroundColor:"#fff",
				pointBorderWidth:1,
				pointHoverRadius:5,
				pointHoverBackgroundColor:"rgba(75,192,192,1)",
				pointHoverBorderColor:"rgba(220,220,220,1)",
				pointHoverBorderWidth:2,
				pointRadius:0,
				pointHitRadius:5,data:[]
			}]
		};
		var optionsGuideChart={
			showLines:!0,
			animation:!1,
			legend:{display:!1},
			scales:{
				xAxes:[{display:!1}],
				yAxes:[{
					id:"Xcorr",
					display:!0,
					position:"left",
					ticks:{
						fontSize:8,
						beginAtZero:!0,
						fontColor:"#4285f4",
						min:-1*YscaleGuideChart,
						max:YscaleGuideChart
					}
				},{
					id:"Ycorr",
					display:!0,
					position:"right",
					ticks:{
						fontSize:8,
						beginAtZero:!0,
						fontColor:"#4285f4",
						min:-1*YscaleGuideChart,
						max:YscaleGuideChart
					}
				}]
			}
		};
		var myGuideChart=new Chart(guideChartCanvas,{
			type:"line",
			data:dataGuideChart,
			options:optionsGuideChart
		});
		
		function updateGuideChartYScale(pixel){		//更新导星图像
			YscaleGuideChart=pixel,
			myGuideChart.options.scales.yAxes[0].ticks.min=-1*YscaleGuideChart,
			myGuideChart.options.scales.yAxes[1].ticks.min=-1*YscaleGuideChart,
			myGuideChart.options.scales.yAxes[0].ticks.max=YscaleGuideChart,
			myGuideChart.options.scales.yAxes[1].ticks.max=YscaleGuideChart,
			localStorage.setItem("YscaleGuideChart",YscaleGuideChart),
			$("#yGuideScaleText").text(YscaleGuideChart),myGuideChart.update()
		}

		function resetGuideGraph(){		//重置导星图像
			for(dataGuideChart.datasets[0].data=[],dataGuideChart.datasets[1].data=[],dataGuideChart.labels=[],i=0;i<totGuidePointData;i++)
				dataGuideChart.datasets[0].data.push(0),
				dataGuideChart.datasets[1].data.push(0),
				dataGuideChart.labels.push(0);
			myGuideChart.update()
		}
		
		function addDataguide(xcorr,ycorr){		//绘制导星曲线
			if(xcorr!=prevXguide||ycorr!=prevYguide){
				prevXguide=xcorr,prevYguide=ycorr;
				var xdata=dataGuideChart.datasets[0].data,
					ydata=dataGuideChart.datasets[1].data;
				xdata.splice(0,1),
				xdata.push(xcorr),
				ydata.splice(0,1),
				ydata.push(ycorr),
				myGuideChart.update()
			}
		}

		//----------jQuery----------
		
		$(function(){
			
			$("#collapseSolvingTable").click(toggleCollapsePlSolvRes),
			$("#collapseSeqTable").click(toggleCollapseSeq),
			$("#collapseResetLocalStorage").click(()=>{		//按钮监听
				$("#resetLocalStorageCont").collapse("toggle")
			}),
			
			resetLocalStorageData=()=>{		//清除本地存储数据
				localStorage.clear(),
				window.location.reload(!0)
			},	
			
			$("#resetLocalStorage").click(e=>{		//按钮监听
					resetLocalStorageData()
			}),
			
			lightRowFilter=(idx,col)=>{
				let item="#focusItem"+idx,colstring=col+" !important",
				elem=document.querySelector(item);
				elem.style.setProperty("background-color",col,"important"),
				elem.style.setProperty("color",setcolorContrast(col))
			},
			
			lightRowFilterOff=()=>{
				$(".focusStatItem").css({background:"#212121",color:"white"})
			},

			$("#navbarAstroAir").outerHeight(!0);
			
			windowWidth=document.documentElement.clientWidth,
			$(".card-header").click((function(){
				var expand='<img src="img/expandIcn.png" alt="xpand">',collapse='<img src="img/collapseIcn.png" alt="collapse">';
				windowWidth<=960?($header=$(this),
				$btn=$(this).find(".collapseBtn"),
				$content=$header.next(),
				$content.slideToggle(300,(function(){
					$btn.html((function(){
						return $content.is(":visible")?collapse:expand
					}))
				}))):(
				$header=$(this),
				$btn=$(this).closest(".row").find(".collapseBtn"),
				$content=$(this).closest(".row").find(".card-body"),
				$content.slideToggle(300,(function(){
					$btn.html((function(){
						return $content.is(":visible")?collapse:expand
					}))
				})))
			})),
			window.onresize=function(event){
				newWidth=document.documentElement.clientWidth,
				newWidth!=windowWidth&&(windowWidth=newWidth,
				newWidth>960&&$(".card-body").slideDown(0,(function(){
					$(".collapseBtn").html('<img src="img/expandIcn.png" alt="xpand">')
				})),
				closeMiniMenu())
			},

			yMinusScale=()=>{		//导星图像Y轴数值减小
				if(YscaleGuideChart>=1){
					let n=YscaleValues.indexOf(YscaleGuideChart);
					updateGuideChartYScale(YscaleValues[n-1]),
					document.getElementById("scaleYplus").disabled=!1
				}else 
					document.getElementById("scaleYminus").disabled=!0;
				YscaleGuideChart<1&&(document.getElementById("scaleYminus").disabled=!0)
			},
			
			yPlusScale=()=>{		//导星图像Y轴数值增大
				if(YscaleGuideChart<6){
					let n=YscaleValues.indexOf(YscaleGuideChart);
					updateGuideChartYScale(YscaleValues[n+1]),
					document.getElementById("scaleYminus").disabled=!1
				}else 
					document.getElementById("scaleYplus").disabled=!0;
				6==YscaleGuideChart&&(document.getElementById("scaleYplus").disabled=!0)
			},
			
			document.getElementById("scaleYminus").addEventListener("click",yMinusScale),		//按钮监听
			document.getElementById("scaleYplus").addEventListener("click",yPlusScale),		//按钮监听
			
			$("#resetFocusChart").click(e=>{		//按钮监听
					resetFocusGraph()
			}),
			$("#resetGuideChart").click(resetGuideGraph),		//按钮监听
			$("#resetTempChart").click(resetTempGraph)		//按钮监听
			$("#resetImgChart").click((function(){
				resetImageGraph()		//重置图像信息图像
			}))
		});
		
		function toggleCollapsePlSolvRes(){		//解析界面
			$("#plSolveColl").collapse("toggle")
		}
		
		function toggleCollapseSeq(){		//计划拍摄界面
			$("#SeqCapture").collapse("toggle")
		}

		function initYScaleGuideChart(){		//初始化导星图像
			getLocalStorageYscaleGuideChart(),		//获取本地存储的导星图像设置
			updateGuideChartYScale(YscaleGuideChart),
			$("#yGuideScaleText").text(YscaleGuideChart)
		}
		
		function getLocalStorageYscaleGuideChart(){		//从本地读取导星信息
			let tempY=JSON.parse(localStorage.getItem("YscaleGuideChart"));
			null!==tempY&&(YscaleGuideChart=tempY)
		}

		//-----------------状态栏---------------
		
		function showStatusBar(text){		//显示状态栏
			if(text!=genStatusText){
				genStatusText=text,
				null==text&&(text=stTextComp("Action running")),
				$("#statusBarTop").html(stTextComp(text));
				var h=$("#navbarAstroAir").outerHeight(!0);
				$("#statusBarContainer").animate({top:h},"fast","swing")
			}
		}
		
		function hideStatusBar(){		//隐藏状态栏
			genStatusText="No action running",
			$("#statusBarTop").text(genStatusText),
			$("#statusBarContainer").delay(200).animate({top:"-10px"},"slow","swing")
		}
		
		function hideStatusBarSelf(){		//隐藏状态栏本身
			$("#statusBarContainer").delay(800).animate({top:"-10px"},"slow","swing")
		}
		
		function stTextComp(text){		//显示文本
			return text+='<div class="float-right "><i class="fas fa-spinner fa-pulse"></i></div>'
		}


		//----------前往网页顶部----------------

		function goToTopPage(){		//前往网页顶部
			document.body.scrollTop=0,
			document.documentElement.scrollTop=0
		}
		
		var btnGoToTop=document.querySelector("#goToTopBtn");
		
		function scrollFunction(){		//按钮隐藏与显示
			document.body.scrollTop>50||document.documentElement.scrollTop>50?btnGoToTop.style.display="block":btnGoToTop.style.display="none"
		}
		
		function easingQuadInOut(t,b,c,d){		//按钮出现条件
			return(t/=d/2)<1?c/2*t*t+b:-c/2*(--t*(t-2)-1)+b}btnGoToTop.addEventListener("click",goToTopPage),window.onscroll=function(){scrollFunction()
		}
	
		//---------------进度显示---------------------
	
		function initSeqCharts(){		//初始化进度显示
			$((function(){
				$("#singleShotChart").easyPieChart(		//初始化单张拍摄进度
				{
					barColor:"#4285f4",onStep:function(from,to,percent){
						$(this.el).find(".percent").text(Math.round(percent))
					}
				})
			})),
			$((function(){
				$("#seqChart").easyPieChart(		//初始化序列拍摄进度
				{
					barColor:"#4caf50",onStep:function(from,to,percent){
						$(this.el).find(".percent").text(Math.round(percent))
					}
				})
			}))
		}
		
		function updateChartSeq(chartId,percent){		//更新拍摄进度
			$(function(){
				$(chartId).data("easyPieChart").update(percent)
			});
		}
		function getPercent(n1,n2){		//获取比值
			var percent=Math.round(n1/n2*100);
			return 0===n1&&(percent=0),percent
		}

		//------------左侧菜单栏------------
		
		$("#handHand").click((function(){		//红色小按钮
			$("#miniMenuContainer").css("left")>="0px"?closeMiniMenu():openMiniMenu()
		}));
		
		closeMiniMenu=()=>{		//关闭菜单栏
			var w=$("#miniMenu").css("width"),
			regexStr=w.match(/[a-z]+|[^a-z]+/gi);
			w=+regexStr[0]-10,
			$("#miniMenuContainer").css("left","-"+w+"px")
		};
		
		openMiniMenu=()=>{		//打开菜单栏
			$("#miniMenuContainer").css("left","4px")
		};
		
		
		var elemFullScreen=document.documentElement;		//全屏
		var ua=window.navigator.userAgent,
			iOS=!!ua.match(/iPad/i)||!!ua.match(/iPhone/i),		//iPhone/iPad
			webkit=!!ua.match(/WebKit/i),		//WebKit
			iOSSafari=iOS&&webkit&&!ua.match(/CriOS/i),		//Safari
			aladin;

		function openFullscreen(){		//开启全屏
			elemFullScreen.requestFullscreen?elemFullScreen.requestFullscreen():elemFullScreen.mozRequestFullScreen?elemFullScreen.mozRequestFullScreen():elemFullScreen.webkitRequestFullscreen?elemFullScreen.webkitRequestFullscreen():elemFullScreen.msRequestFullscreen&&elemFullScreen.msRequestFullscreen()
		}
		
		function closeFullscreen(){		//关闭全屏
			document.exitFullscreen?document.exitFullscreen():document.mozCancelFullScreen?document.mozCancelFullScreen():document.webkitExitFullscreen?document.webkitExitFullscreen():document.msExitFullscreen&&document.msExitFullscreen()}switchFullscreen=()=>{document.fullscreenElement?closeFullscreen():openFullscreen()
		}
		
		function testPerformance(){
			const startTime=performance.now(),
			duration=performance.now()-startTime
		}
		
		iOSSafari?$("#fsBtn").addClass("d-none"):$("#fsBtn").click(()=>{		//打开/关闭全屏
			switchFullscreen()
		}),
		
		$("#collapseAllBtn").click(()=>{collapseAllPanels()}),collapseAllPanels=e=>{		//关闭所有窗口并到网页顶部
			$(".card-body").slideUp(300,(function(){
				closeMiniMenu(),
				goToTopPage()
			}))
		};
		
		$(".menuBtn").click((function(){		//菜单按钮
			var h=$("#navbarAstroAir").css("height");
			$(".anchor").css("top","-"+h),
			$("#handHand").click()
		}));
		
		//----------解析-----------
		
		function sendRemoteSolveAndSync(){		//发送解析并同步命令
			var Req={
				method:"RemoteSolveActualPosition",
				params:{}
			};
			Req.params.UID=generateUID(),
			Req.params.IsBlind=blindsolve,
			Req.params.IsSync=!0,
			Req.id=generateID(),
			pushUid("sendRemoteSolveAndSync",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function sendRemoteSolveAndSyncReceived(obj){		//接收解析并同步命令结果
			$("#solvedStatText").text(obj.IsSolved),obj.IsSolved?$("#solvedStatText").removeClass("text-warning").addClass("text-success"):($("#solvedStatText").removeClass("text-success").addClass("text-warning"),
			$("#solvedStatText").append(" - "+obj.LastError));
			let tempRa=obj.RA,tempDec=obj.DEC,tempPa=obj.PA;
			tempPa=tempPa.toFixed(1),tempPa<0&&(tempPa+=360),$("#solvRA").text(tempRa),$("#solvDEC").text(tempDec),$("#solvPA").text(tempPa)
		}
		
		function sendRemoteSolveNoSync(){		//发送解析命令
			var Req={method:"RemoteSolveActualPosition",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsBlind=blindsolve,
			Req.params.IsSync=!1,
			Req.id=generateID(),
			pushUid("sendRemoteSolveNoSync",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function sendRemoteSolveNoSyncReceived(obj){		//接收解析命令结果
			sendRemoteSolveAndSyncReceived(obj)
		}
	
		//---------------日志-----------------
	
		function logEventReceived(msg){		//接收日志事件
			$("#logDiv > span").length>500&&$(".logContRow:last").remove();
			var type=msg.Type,text=msg.Text.replace(/(?:\r\n|\r|\n)/g,"<br>");
			writeToLog(timeStampUtility(msg.TimeInfo)+" &emsp;<span class='logMsgType "+logColors[type]+"'>[ "+logType[type]+" ]</span> &emsp; "+text),5!==type&&6!==type||($("#generalActionText").text(msg.Text),showStatusBar(msg.Text))
		}
		
		$("#resetLog").click((function(){		//刷新日志
			document.getElementById("logDiv").innerHTML="";
		}));
	
		function writeToLog(message){		//显示日志
			var tempRow='<span class="logContRow">'+ message.toString()+"</span>";
			$(function(){
				$("#logDiv").prepend(tempRow);
			});
		}

		function timeStampUtility(timestamp){		//获取时间戳
			var date=new Date(1e3*timestamp),hours=date.getHours()+date.getTimezoneOffset()/60;
			hours<0&&(hours+=24),hours=hours.toString()
			var minutes=date.getMinutes().toString(),
				seconds=date.getSeconds().toString(),
				millsec=date.getMilliseconds().toString(),
				formattedTime;
			return padZeroStr(hours)+":"+padZeroStr(minutes)+":"+padZeroStr(seconds)+"."+padZeroStr(millsec,3)
		}
	
		function getTimeNow(){		//获取当前时间
			var today=new Date,hours="0"+today.getHours(),minutes="0"+today.getMinutes(),seconds="0"+today.getSeconds(),millsec="00"+today.getMilliseconds(),formattedTime;
			return hours.substr(-2)+":"+minutes.substr(-2)+":"+seconds.substr(-2)+"."+millsec.substr(-3)
		}
	
		//-------------图像查看-------------
		
		function newJPGReadyReceived(msg){		//新的JPEG已经生成，接收对应的图像信息
			imgShooting=!1,		//相机不在拍摄
			resetShotPanel(),		//重置拍摄计划
			loadImg64(msg.Base64Data,msg.PixelDimX,msg.PixelDimY);		//加载图像在网页中显示
			var imgObj={};
			""===msg.SequenceTarget?($("#SequenceTarget").text("No Target"),imgObj.Target="No Target"):($("#SequenceTarget").text(msg.SequenceTarget),imgObj.Target=msg.SequenceTarget),		//判断是否为计划拍摄，并显示
			$("#Bin").text(msg.Bin),		//BIN，像素合并
			$("#StarIndex").text(msg.StarIndex),		//星点数
			$("#HFD").text(msg.HFD),		//FWHM，半宽高
			$("#Expo").text(msg.Expo),		//曝光时间
			imgObj.Bin=msg.Bin,		//赋值
			imgObj.StarIndex=msg.StarIndex,		//赋值
			imgObj.HFD=msg.HFD,		//赋值	
			imgObj.Expo=msg.Expo,		//赋值
			imgObj.Time=timeStampUtility(msg.TimeInfo),		//赋值
			imgObj.NameFile=extractNamefile(msg.File),		//赋值
			"** BayerMatrix **"===msg.Filter?($("#Filter").text("No Filter"),imgObj.Filter="No Filter"):($("#Filter").text(msg.Filter),imgObj.Filter=msg.Filter),		//判断是否有滤镜，并显示
			imageStatsArrayAdd(imgObj)		//写入图像状态栏
		}
		
		function extractNamefile(str){		//整理图像名称
			var name;
			return str.slice(str.lastIndexOf("\\")+1)
		}
		
		function imageStatsArrayAdd(data){		//在图像状态栏中显示当前图像信息
			imageStats.length<8?imageStats.unshift(data):(imageStats.pop(),imageStats.unshift(data)),
			addDataImage(data.HFD,data.StarIndex),
			updateImageStatsTable()
		}
		
		function updateImageStatsTable(){		//更新图像状态栏
			$(".imgStatItem").remove(),
			imageStats.forEach(element=>{
				$("#imgStatsUl").append('<li class="list-group-item bg-dark d-flex align-items-center justify-content-between imgStatItem p-2"><span class="info-data-item extraSmallText col m-0 p-0">'+element.Time+'</span><span class="info-data-item extraSmallText col-2 m-0 p-0">'+element.Target+'</span><span class="info-data-item extraSmallText col-2 m-0 p-0">'+element.Filter+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+element.Bin+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+element.StarIndex+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+element.HFD+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+element.Expo+"</span></li>")
			})
		}

		function loadImg64(img64str,dimX,dimY){		//加载JPG图像
			$(function(){
				var inImageStr,image64=img64str;
				$("#img_preview").attr("src",image64),$("#img_preview_a").attr("href",image64);
				var sizePx=dimX+"x"+dimY;
				document.querySelector("#img_preview_a").setAttribute("data-size",sizePx)
			});
		}

		function imagePreviewLoading(){		//正在加载图像预览
			$("#img_preview_a").append('<div class="mask pattern-9 flex-center" id="loadingOverlayImg"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div></div>')
		}
		
		//------------连接设备--------------
		
		armProfSelBtn=()=>{
			const profileBtnSelector=".btProf",profileBtnSelect=document.querySelectorAll(".btProf");
			profileBtnSelect.forEach(btn=>{
				btn.addEventListener("click",e=>{
					let profName=e.currentTarget.name;
					$("#cont-profile-list").addClass("d-none"),
					$("#selectedProfile").text(""),
					setNewProfile(profName)
				})
			})
		},
		
		armCloseProfileList=()=>{
			document.querySelector("#closeProfileListtBtn").addEventListener("click",e=>{
				$(".prof-li").remove(),
				$("#cont-profile-list").addClass("d-none")
			})
		},
		
		setNewProfile=name=>{
			var Req={method:"RemoteSetProfile",params:{}};
			Req.params.UID=generateUID(),
			Req.params.FileName=name,
			Req.id=generateID(),
			pushUid(Req.method,Req.params.UID),
			doSend(JSON.stringify(Req))
		},
		
		remoteSetProfileReceived=()=>{},
		
		profileChangedReceived=msg=>{
			$("#selectedProfile").text(msg.NewProfile),
			updateActualProfile(msg.NewProfile)
		};
		
		function remoteSetupConnected(){		//连接已建立
			startupConnected=!0,
			setTimeout(getFilterConfiguration,500),
			$("#startupConn").html("已连接").removeClass("disabled").addClass("btn-success"),
			setBtnActive("#startupDisConn, #abortAllBtn, #haltAllBtn"),
			setBtnNotActive("#profileListtBtn"),
			$("#startupConn").css("pointer-events","none"),
			$("#startupConnLed").hasClass("ledgreen")||$("#startupConnLed").addClass("ledgreen")
		}
		
		function remoteSetupTimedOut(){		//连接超时
			errorFire("设备连接超时!请检查AstroAir服务器."),
			remoteSetupBtnReset()
		}
		
		function remoteSetupError(name,msg){		//连接错误
			errorFire(name+": "+msg+" 请检查AstroAir服务器，并重置连接."),
			remoteSetupBtnReset()
		}
		
		function remoteSetupDisconnected(){		//与设备断开连接
			remoteSetupBtnReset(),
			setInitialBtnActive(),
			setBtnActive(".lev1active"),
			stopAnimLogo(),
			hideStatusBar()
		}
		
		function remoteSetupBtnReset(){		//重置连接按钮
			$("#startupConn").html("连接").removeClass("disabled").removeClass("btn-success"),
			setBtnNotActive("#startupDisConn"),
			setBtnActive("#profileListtBtn"),
			$("#startupConn").css("pointer-events","auto"),
			resetEnvironmentData(),
			startupConnected=!1,
			$("#startupConnLed").hasClass("ledgreen")&&$("#startupConnLed").removeClass("ledgreen")
		}

		function remoteSetupBtnResetAbort(){
			startupConnected||remoteSetupBtnReset()
		}
		
		function remoteEnvironmentDataReceived(ParamRet){
			for(var k in ParamRet)
				""!==ParamRet[k]&&$("#envUl").append('<li class="list-group-item bg-dark d-flex align-items-center justify-content-between env-element-li" id="li_env_'+k+'"><span class="text-muted info-data-item text-uppercase" id="tit_env_'+k+'">'+k+'</span><span class="environmentField info-data-item text-right" id="text_env_'+k+'">'+ParamRet[k]+"</span></li>");
			$("#tit_env_Profile, #text_env_Profile").addClass("text-warning"),$("#li_env_Profile").addClass("evid_bkg");
			let profileName=$("#text_env_Profile").text();
			""!=profileName&&$("#selectedProfile").text(profileName)
		}

		//----------控制信息-----------
		
		function controlDataReceived(msg){		//接收控制信息
			if(ccdConnected=msg.CCDCONN,		//相机是否连接
				planConnected=msg.PLACONN,		//计划拍摄是否连接
				ccdCoolerOn=msg.CCDCOOL,		//相机是否在制冷
				guideConnected=msg.GUIDECONN,		//PHD2是否连接
				autofocusConnected=msg.AFCONN,		//自动对焦是否连接
				setupconn=msg.SETUPCONN,
				plateSolveConnected=msg.PSCONN,		//astrometry是否就位
				mountTracking=msg.MNTTRACK,		//赤道仪是否在跟踪
				mountParked=msg.MNTPARK,		//赤道仪是否归位
				mountFlip=msg.MNTTFLIP,
				mountSlew=msg.MNTSLEW,		//赤道仪是否在移动
				focuserTemp=msg.AFTEMP,		//电调当前温度
				focuserPosition=msg.AFPOS,		//电调当前位置
				ccdStatus=msg.CCDSTAT,		//相机状态
				$("#generalStatusText").text(airStatusCodes[msg.AIRSTAT]),		//显示服务器状态
				2===msg.AIRSTAT?(		//服务器正在运行
					airIsRunning||(
						airIsRunning=!0,		//服务器正在运行
						disableActions(),		//禁止动作
						animLogo(),
						""==$("#generalActionText").text()&&$("#generalActionText").text("等待进度信息")
					),
					airIsRunning=!0
				):(		//服务器空闲
					airIsRunning&&(
						airIsRunning=!1,
						$("#generalActionText").text("没有动作正在进行"),
						stopAnimLogo(),
						airIsRunning||enableActions()
					),
					hideStatusBar(),		//隐藏状态栏
					airIsRunning=!1	
				),
				$("#runSeqText, #seqRunTextTop").text(msg.RUNSEQ),
				$("#seqDSTextTop").text(msg.RUNDS),
				""!=msg.RUNSEQ?(		//是否在计划拍摄
					$("#seqStartTime").text(msg.SEQSTART),
					$("#seqRemain").text(msg.SEQREMAIN),
					$("#seqEndTime").text(msg.SEQEND),
					$("#seqRunli").addClass("d-flex").removeClass("d-none")
				):(
					$("#seqStartTime").text(""),
					$("#seqRemain").text(""),
					$("#seqEndTime").text(""),
					$("#seqRunli").addClass("d-none").removeClass("d-flex")
				),
				""!=msg.RUNDS?(		//判断是否在单张拍摄
					$("#dsRunli").addClass("d-flex").removeClass("d-none"),
					$("#dragRunnTextTop").text(msg.RUNDS)
				):$("#dsRunli").addClass("d-none").removeClass("d-flex"),
				mountConnected!==msg.MNTCONN&&(		//判断赤道仪是否连接
					mountConnected=msg.MNTCONN,
					$(".mount-btn-noact").toggleClass("disabled")
				),
				mountConnected?(		//判断赤道仪是否连接
					$("#mountStatLed").hasClass("ledgreen")||(		//赤道仪已连接
						$("#mountStatLed").addClass("ledgreen"),
						$("#simulatorSelected").removeAttr("disabled")
					),
					airIsRunning||setBtnActive(".mount-btn"),
					$("#mntRA").text(msg.MNTRA),		//显示赤道仪当前RA
					$("#mntDEC").text(msg.MNTDEC),		//显示赤道仪当前DEC
					$("#mntAZ").text(msg.MNTAZ),		//显示赤道仪当前AZ
					$("#mntALT").text(msg.MNTALT),		//显示赤道仪当前ALT
					$("#mntPier").text(msg.MNTPIER),
					$("#mntFlip").text(msg.MNTTFLIP),
					$("#TI").text(msg.TI),
					tempRaRec=msg.MNTRAJ2000,
					tempDecRec=msg.MNTDECJ2000
				):(
					$("#mountStatLed").hasClass("ledgreen")&&(		//赤道仪未连接
						$("#mountStatLed").removeClass("ledgreen"),
						$("#simulatorSelected").attr("disabled",!0)
					),
					$("#mntRA").text(""),		//赤道仪RA清零
					$("#mntDEC").text(""),		//赤道仪DEC清零
					$("#mntAZ").text(""),		//赤道仪AZ清零
					$("#mntALT").text(""),		//赤道仪ALT清零
					$("#mntPier").text(""),
					$("#mntFlip").text(""),
					$("#TI").text(""),
					$("#parkStatText").text(""),
					setBtnNotActive(".mount-btn")
				),
				plateSolveConnected?airIsRunning||setBtnActive(".solve-btn"):setBtnNotActive(".solve-btn"),		//判断Astrometry是否准备就绪
				ccdConnected?(		//判断相机是否连接
					$("#ccdStatLed").hasClass("ledgreen")||$("#ccdStatLed").addClass("ledgreen"),		//相机已连接
					$(".coolerBtn").hasClass("disabled")&&!airIsRunning&&setBtnActive(".coolerBtn, .seq-btns, #remoteShotbtn")
				):(
					$("#ccdStatLed").hasClass("ledgreen")&&$("#ccdStatLed").removeClass("ledgreen"),		//相机未连接
					shotBtnReset(),
					setBtnNotActive("#remoteShotbtn,.coolerBtn,.seq-btns")
				),
				planConnected?(
					$("#planStatLed").hasClass("ledgreen")||$("#planStatLed").addClass("ledgreen"),
					airIsRunning||setBtnActive(".searchBtn")
				):(
					$("#planStatLed").hasClass("ledgreen")&&$("#planStatLed").removeClass("ledgreen"),
					setBtnNotActive(".searchBtn")
				),
				setupconn&&!startupConnected?remoteSetupConnected():!setupconn&&startupConnected&&remoteSetupDisconnected(),
				ccdConnected?(		//判断相机是否连接，制冷部分
					$("#coolerStatus").text(coolerStat[ccdStatus]),
					addDataTemp(msg.CCDTEMP,msg.CCDPOW,msg.CCDSETP)
				):$("#coolerStatus").text(""),
				mountConnected&&mountParked?$("#parkStatText").text("已归位").removeClass("text-danger text-success text-primary text-warning").addClass("text-danger"):		//赤道仪是否归位
				mountConnected&&mountSlew?$("#parkStatText").text("正在移动").removeClass("text-danger text-success text-primary text-warning").addClass("text-primary"):		//赤道仪是否正在移动
				mountConnected&&mountTracking?$("#parkStatText").text("跟踪").removeClass("text-danger text-success text-primary text-warning").addClass("text-success"):	//赤道仪是否在跟踪
				!mountConnected||mountTracking||mountParked||mountSlew||$("#parkStatText").text("已停止").removeClass("text-danger text-success text-primary text-warning").addClass("text-warning"),		//赤道仪是否停止
				updateChartSeq("#seqChart",getPercent(msg.SEQPARZ,msg.SEQTOT)),		//更新拍摄进度
				msg.GUIDECONN
			){
				let x=secondDecimal(msg.GUIDEX),
					y=secondDecimal(msg.GUIDEY);
				addDataguide(x,y),
				$("#xErrGuide").text(secondDecimal(x)),
				$("#yErrGuide").text(secondDecimal(y)),
				$("#guideStatLed").hasClass("ledgreen")||$("#guideStatLed").addClass("ledgreen")
			}else 
				$("#guideStatLed").hasClass("ledgreen")&&$("#guideStatLed").removeClass("ledgreen"),
					$("#xErrGuide").text(""),
					$("#yErrGuide").text("");
			msg.AFCONN?(
				$("#focusTemp").text(msg.AFTEMP),
				$("#focusPosition").text(msg.AFPOS),
				$("#focusStatLed").hasClass("ledgreen")||(
					$("#focusStatLed").addClass("ledgreen"),
					$("#afInjBtn").hasClass("disabled")&&setBtnActive("#afInjBtn")
				)
			):(
				$("#focusStatLed").hasClass("ledgreen")&&$("#focusStatLed").removeClass("ledgreen"),
				$("#focusTemp").text(""),
				$("#focusPosition").text("")
			)
		}
		
		function enableActions(){
			airIsRunning||(btnTempActive.forEach((function(item){
				var id;
				""!=item.id&&setBtnActive("#"+item.id)
			})),
			$("body").css("cursor","default"),resetShotPanel())
		}
		
		function disableActions(){
			if(airIsRunning){
				var elements=document.querySelectorAll(".actBtn:not(.disabled)");
				btnTempActive.length=0,
				(btnTempActive=[].slice.call(elements)).forEach((function(item){
					var id;
					""!=item.id&&setBtnNotActive("#"+item.id)
				})),
				$("body").css("cursor","progress")
			}
		}

		function startupConnect(){
			var Req={method:"RemoteSetupConnect",params:{}};
			Req.params.UID=generateUID(),
			Req.params.TimeoutConnect=90,
			Req.id=generateID(),
			pushUid("RemoteSetupConnect",Req.params.UID),
			doSend(JSON.stringify(Req)),
			$("#startupConn").html('<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>Connecting...').addClass("disabled"),
			setBtnNotActive("#profileListtBtn")
		}
		
		$("#startupConn").click(startupConnect),
		
		startupDisconnectionReq=()=>{
			var Req={method:"RemoteSetupDisconnect",params:{}};
			Req.params.UID=generateUID(),
			Req.params.TimeoutDisconnect=90,
			Req.id=generateID(),
			pushUid("RemoteSetupDisconnect",Req.params.UID),
			doSend(JSON.stringify(Req))
		},

		//----------相机------------------

		$("#remoteShotbtn").click(RemoteCameraShot);

		function RemoteCameraShot(){		//相机拍摄
			var Req={method:"RemoteCameraShot",params:{}};
			Req.params.UID=generateUID(),
			Req.params.Expo=$("#ex").val(),		//曝光时间
			Req.params.Bin=$("#bin").val();		//像素合并
			Req.params.IsROI=!1,
			Req.params.ROITYPE=0,	//芯片类型
			Req.params.ROIX=0,		//CCD芯片长
			Req.params.ROIY=0,		//CCD芯片宽
			Req.params.ROIDX=0,		//像素长
			Req.params.ROIDY=0,		//像素宽
			Req.params.FilterIndex=$("#filter").val()-1,		//滤镜
			Req.params.ExpoType=0,		//曝光类型
			Req.params.SpeedIndex=0,		//相机速度
			Req.params.ReadoutIndex=0,		//超时时间
			Req.params.IsSaveFile=!0,		//是否保存图像
			Req.params.FitFileName="%%fitdir%%\\RemoteSingleShot_"+getTimeString()+".fit",		//图像名称
			Req.params.Gain=$("#gain").val(),		//增益
			Req.params.Offset=$("#offset").val(),		//偏执
			Req.id=generateID(),
			pushUid("RemoteCameraShot",Req.params.UID),
			tempUIDshot=Req.params.UID,
			imgShooting=!0,
			doSend(JSON.stringify(Req)),
			shotBtnShooting(),		//相机正在拍摄中
			setBtnActive("#remoteShotAbortbtn")		//激活按钮
		}
		
		function abortRemoteAction(UID){		//停止拍摄
			var Req={method:"RemoteActionAbort",params:{}};
			Req.params.UID=UID,
			Req.id=generateID(),
			doSend(JSON.stringify(Req))
		}

		function remoteCameraShotOk(){		//拍摄完成
			imgShooting=!1,
			resetShotPanel()		//重置拍摄计划
		}
		
		function remoteSetLogEventReceived(){		//设置日志时间接收
			setTimeout(getAstroAirProfiles(!0),400),
			getProfileName()		//获取配置文件名称
		}		
		
		function newFitReadyReceived(){			//新的Fits图像拍摄完成
			imgShooting=!1
		}
		
		function remoteCameraShotError(msg){		//相机拍摄错误
			errorFire("RemoteCameraShot error: "+msg),
			imgShooting=!1,
			resetShotPanel(),
			loadingOverlayRemove()
		}
		
		function remoteCameraShotAborting(){}		//相机拍摄正在停止中
		
		function remoteCameraShotAborted(){		//相机拍摄已停止
			imgShooting=!1,
			resetShotPanel(),
			errorFire("拍摄停止 ","曝光终断!")
		}

		function shotBtnShooting(){		//相机正在拍摄
			$("#remoteShotbtn").html('<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>拍摄中...').addClass("disabled")
		}

		function shotBtnDownloading(){		//正在下载图像
			$("#remoteShotbtn").html('<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>下载中...')
		}
		
		function stopAnimatePreDownload(){
			progBarStopAndReset()
		}
		
		function animatePreDownload(){
			$("#animBar").animate({opacity:"+=1"},500),
			$("#animBar").animate({opacity:"-=0.9"},1e3,animatePreDownload)
		}

		function stopAnimatePreDownload(){
			progBarStopAndReset()
		}

		function resetShotPanel(){		//重置拍摄计划
			shotBtnReset(),
			setBtnNotActive("#remoteShotAbortbtn"),
			stopAnimatePreDownload(),
			$("#cameraStatus").text(""),
			resetShotInfo()
		}
		
		function arrayElementDataReceived(msg){}
		
		function shotRunningReceived(msg){		//接收拍摄信息
			switch(updateChartSeq("#singleShotChart",msg.ElapsedPerc),progBarPerc(msg.ElapsedPerc),populateShotInfo(msg),msg.Status){
				case 0:
					stopAnimatePreDownload(),
					shotBtnReset(),
					imgShooting=!1;
					break;
				case 1:		//正在拍摄
					imgShooting||(shotBtnShooting(),imgShooting=!0);
					break;
				case 2:		//动画加载预览
					animatePreDownload();
					break;
				case 3:		//正在加载预览
					imagePreviewLoading(),
					stopAnimatePreDownload(),
					shotBtnReset(),
					imgShooting=!1;
					break;
				case 4:		//重置拍摄计划
					resetShotPanel(),
					stopAnimatePreDownload(),
					loadingOverlayRemove(),
					imgShooting=!1,
					errorFire(shotStatusCodes[msg.Status]);
					break;
				default:		//拍摄完成
					imgShooting=!1,
					resetShotPanel(),
					stopAnimatePreDownload(),
					loadingOverlayRemove()
			}
			cameraStatus=shotStatusCodes[msg.Status],
			$("#cameraStatus").text(cameraStatus)		//显示相机信息
		}
		
		populateShotInfo=msg=>{
			document.querySelector("#fileShotText").textContent=msg.File,
			document.querySelector("#expoText").textContent=msg.Expo,
			document.querySelector("#elapsedText").textContent=msg.Elapsed,
			document.querySelector("#remainText").textContent=msg.Expo-msg.Elapsed
		},

		function loadingOverlayRemove(){
			$("#loadingOverlayImg").remove()
		}

		function progBar(seconds){
			var duration=1e3*seconds;$("#animBar").width(0),
				$("#animBar").animate({width:"100%"},
				duration,"linear",
				(function(){animatePreDownload()}))
		}
		
		function progBarPerc(perc){
			var percStr=perc+"%";
			$("#animBar").width(percStr),
			100==perc&&(animatePreDownload(),setBtnNotActive("#remoteShotAbortbtn"),shotBtnDownloading())
		}
		
		function progBarReset(){
			$("#animBar").width(0),
			$("#animBar").css("opacity","1"),
			updateChartSeq("#singleShotChart",0)
		}

		function progBarStopAndReset(){
			$("#animBar").stop(!0),
			progBarReset()
		}
		
		function animatePreDownload(){
			$("#animBar").animate({opacity:"+=1"},500),
			$("#animBar").animate({opacity:"-=0.9"},1e3,animatePreDownload)
		}
		
		function getTimeString(){
			var today=new Date,time;
			return today.getFullYear()+today.getMonth()+today.getDay()+"_"+today.getHours()+today.getMinutes()+today.getSeconds()
		}
		
		//----------制冷-------------
		
		var coolerONdata={
				setpoint:!1,
				cooldown:!1,
				async:!0,
				warmup:!1,
				cooleroff:!1
			},
			coolerOFFdata={
				setpoint:!1,
				cooldown:!1,
				async:!0,
				warmup:!1,
				cooleroff:!0
			},
			setTempData={
				setpoint:!0,
				cooldown:!0,
				async:!0,
				warmup:!1,
				cooleroff:!1
			},
			warmUpData={
				setpoint:!1,
				cooldown:!1,
				async:!0,
				warmup:!0,
				cooleroff:!1
			},
			coolDownData={
				setpoint:!1,
				cooldown:!0,
				async:!0,
				warmup:!1,
				cooleroff:!1
			};
	
		$("#coolerOnBtn").click({conf:coolerONdata},remoteCooling);		//开启制冷
		$("#coolerOffBtn").click({conf:coolerOFFdata},remoteCooling);		//关闭制冷
		$("#setTempBtn").click({conf:setTempData},remoteCooling);		//设置目标温度
		$("#warmupBtn").click({conf:warmUpData},remoteCooling);		//升温
		$("#coolDownBtn").click({conf:coolDownData},remoteCooling);		//降温
		
		function remoteCooling(obj){		//将制冷信息发送至服务端
			var Req={method:"RemoteCooling",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsSetPoint=obj.data.conf.setpoint,
			Req.params.IsCoolDown=obj.data.conf.cooldown,
			Req.params.IsASync=obj.data.conf.async,
			Req.params.IsWarmup=obj.data.conf.warmup,
			Req.params.IsCoolerOFF=obj.data.conf.cooleroff,
			Req.params.Temperature=$("#cameraTemp").val(),
			Req.id=generateID(),
			pushUid("RemoteCooling",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		//----------滤镜轮----------------
		
		getFilterConfigurationReceived=msg=>{		//接收滤镜轮配置信息
			updateFilterSelect(msg.ParamRet)
		},
		
		function updateFilterSelect(paramRet){		//更新滤镜轮选择
			let filterCamera,filterFocus="#filterSelectFocus";
			populateFilterSelectRoutine(paramRet,"#filterSelect"),
			populateFilterSelectRoutine(paramRet,filterFocus),
			populateFilterListArray(paramRet),
			getActualFilter(),
			setTimeout(getEnvironmentData,500)
		}

		function updateFilterActual(paramRet){		
			updateFilterActualRoutine(paramRet,"#filterSelect"),
			updateFilterActualRoutine(paramRet,"#filterSelectFocus")
		}
		
		populateFilterListArray=paramRet=>{
			for(cameraFilterList=[],i=1;i<=paramRet.FilterNum;i++){
				var filtername="Filter"+i+"_Name";
				cameraFilterList.push(paramRet[filtername])
			}
		},
		
		updateFilterActualRoutine=(paramRet,selectId)=>{
			let dropdown=$(selectId);
			-1==paramRet.FilterIndex&&(paramRet.FilterIndex=0),
			dropdown.prop("selectedIndex",paramRet.FilterIndex+1)
		},
		
		function getEnvironmentData(){
			var Req={method:"RemoteGetEnvironmentData",params:{}};
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteGetEnvironmentData",Req.params.UID),
			doSend(JSON.stringify(Req))
		}

		function getFilterConfiguration(){
			var Req={method:"RemoteGetFilterConfiguration",params:{}};
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteGetFilterConfiguration",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function getActualFilter(){
			var Req={method:"RemoteFilterGetActual",params:{}};
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteFilterGetActual",Req.params.UID),
			doSend(JSON.stringify(Req))
		}

		function executeFilterApp(txt){
			let tempCont="";
			switch(txt){
				case"Name":
					case"Group":
						case"Note":
							tempCont=txt;
							break;
				case"Clear":
					tempCont="Select",
					resetFilterCont();
					break;
				default:
					tempCont="Select"
			}
			$("#filter-btn-id").text(tempCont)
		}
		
		function resetFilterCont(){
			if(preResetFilters(),rcFilterSelected){
				rcFilterSelected=!1;
				let order=roboClipOrder;
				resetRcField(),
				$("#roboClipModal").modal("hide"),
				setTimeout((function(){
					roboClipOrder=order,
					sendRemoteRoboClipGetTargetList()
				}),500)
			}
		}
		
		function preResetFilters(){
			resetFilterVar(),
			$("#filterText").val(""),
			$("#filter-btn-id").text("Select")
		}
		
		function rcFilterActivation(){
			let tempFilterType=$("#filter-btn-id").text(),txt=$("#filterText").val();
			if(resetFilterVar(),"Select"!=tempFilterType&&""!=txt){
				let order=roboClipOrder;
				$("#roboClipModal").modal("hide"),
				setTimeout((function(){
					switch(roboClipOrder=order,rcFilterSelected=!0,tempFilterType){
						case"Name":
							roboClipNameTxt=txt;
							break;
						case"Group":
							roboClipGroupTxt=txt;
							break;
						case"Note":
							roboClipNoteTxt=txt
					}
					sendRemoteRoboClipGetTargetList()
				}),500)
			}else
				""!=txt&&($("#filter-btn-id").addClass("animated bounceIn fast"),
				$("#filter-btn-id").one("webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend",
				(function(){
					$("#filter-btn-id").removeClass("animated bounceIn fast")
				})))
		}
		
		function resetFilterVar(){
			roboClipNameTxt="",
			roboClipGroupTxt="",
			roboClipNoteTxt=""
		}
		
		function reloadAfterFilterSelectEmpty(){
			var timeleft=10,
				downloadTimer=setInterval((function(){
					document.getElementById("progressBarReload").value=timeleft,
					document.getElementById("timerText").innerText=timeleft+" sec",
					(timeleft-=1)<=0&&(clearInterval(downloadTimer),
					resetFilterCont())
				}),1e3)
		}

		//----------赤道仪-----------
		
		$("#resetSearchBtn").click(resetSearchField);		//重置搜索
		$("#searchBtn").click({ident:0},remoteSearchTarget);		//搜索目标
		$("#preciseGoTo").click((function(){		//坐标搜索目标
			""===$("#raSearch").val()&&""===$("#decSearch").val()?errorFire("请输入天体的RA和DEC坐标","坐标输入为空"):precisePointTarget()
		}));
		
		function resetSearchField(){		//重置搜索输入框
			$(".searchField").val(""),
			removeObjectDetail()
		}
		
		function removeObjectDetail(){		//去除目标信息
			$(".obj-data-item").remove(),
			$("#cont-detail-obj").addClass("d-none")
		}

		function remoteSearchTarget(type){		//通过名称搜索目标
			var Req={method:"RemoteSearchTarget",params:{}};
			Req.params.UID=generateUID(),
			Req.params.Name=$("#nameToSearch").val(),
			Req.params.SearchType=type.data.ident,
			Req.id=generateID(),
			pushUid("RemoteSearchTarget",Req.params.UID),
			tempUIDsearch=Req.params.UID,
			doSend(JSON.stringify(Req)),
			removeObjectDetail()
		}
		
		function precisePointTarget(){		//通过坐标搜索目标
			var Req={method:"RemotePrecisePointTarget",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsText=!0,
			Req.params.RA=0,
			Req.params.DEC=0,
			Req.params.RAText=$("#raSearch").val(),
			Req.params.DECText=$("#decSearch").val(),
			Req.id=generateID(),
			pushUid("RemotePrecisePointTarget",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function precisePointTargetNumber(raDecNum){
			var Req={method:"RemotePrecisePointTarget",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsText=!1,
			Req.params.RA=parseFloat(raDecNum[0]),
			Req.params.DEC=parseFloat(raDecNum[1]),
			Req.params.RAText="",
			Req.params.DECText="",
			Req.id=generateID(),
			pushUid("RemotePrecisePointTarget",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function remotePrecisePointTargetOk(){}
		
		function remotePrecisePointTargetError(msg){
			errorFire(msg)
		}

		//----------获取设备信息------------

		function RemoteGetCCDSizeInfoEx(){		//获取虚拟视野大小
			var Req={method:"RemoteGetCCDSizeInfoEx",params:{}};
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteGetCCDSizeInfoEx",Req.params.UID),
			doSend(JSON.stringify(Req))
		}

		handleProfileAlert=()=>{
			null!=connectedProfileName&&(actualCcdData.DX==connectedCcdData.DX&&actualCcdData.DY==connectedCcdData.DY&&actualCcdData.PixelSize==connectedCcdData.PixelSize&&actualCcdData.Focallen==connectedCcdData.Focallen?(sameFov=!0,showHideAlertProfile()):(sameFov=!1,showHideAlertProfile()))
		},
		
		showHideAlertProfile=()=>{
			sameFov?(document.getElementById("alertFovDiv").classList.remove("d-block"),
			document.getElementById("alertFovDiv").classList.add("d-none")):(document.getElementById("alertFovDiv").classList.add("d-block"),
			document.getElementById("alertFovDiv").classList.remove("d-none"))
		},
	
		getProfileNameReceived=ParamRet=>{		//接收配置文件
			updateActualProfile(ParamRet.Profile)
		},
		
		updateActualProfile=profName=>{		//更新配置文件名称
			actualProfileName=sanitizeProfileName(profName),
			connectedProfileName=actualProfileName,
			fovdata.profileName=actualProfileName
		},
		
		sanitizeProfileName=str=>{
			let sanString;
			return str.replace(/\s+/g,"_")
		},

		getAstroAirProfiles=startup=>{
			let isStartup=startup||!1;
			var Req={method:"RemoteGetAstroAirProfiles",params:{}};
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid(isStartup?"RemoteGetAstroAirProfilesstartup":Req.method,Req.params.UID),
			doSend(JSON.stringify(Req))
		},
		
		remoteAstroAirProfileStartupReceived=msg=>{
			let temparr,activeProfile=msg.list.find(x=>!0===x.isactive).name;
			$("#selectedProfile").text(activeProfile),
			updateActualProfile(activeProfile)
		},
		
		remoteGetAstroAirProfilesReceived=msg=>{		//接收AstroAir设备配置文件信息
			let temparr=msg.list,
				activeProfile=temparr.name;
			$("#selectedProfile").text(activeProfile),
			startupConnected||(
				armCloseProfileList(),
				$(".prof-li").remove(),
				$("#cont-profile-list").removeClass("d-none"),
				temparr.length>0?(
					temparr.forEach(profItem=>{
						let classGreen=profItem.isactive?"text-primary":"",
						disabled=profItem.isactive?"disabled":"",
						contPh="active",
						placeholder=profItem.isactive?contPh:"select";
						$("#profileUl").append('<li class="list-group-item bg-dark align-items-center prof-li"><div class="row w-100"><div class="info-data-item text-left px-1 col-11 my-auto '+classGreen+'">'+profItem.name+'</div><div class="col-1 my-auto p-0"><button class="btn btn-sm btn-primary m-auto flex-end px-2 py-1 btProf '+disabled+'" type="button" name="'+profItem.name+'">'+placeholder+"</button></div></div></li>")
					}),
					armProfSelBtn()
				):(
					errorFire("在指定文件夹中没有配置文件!","文件未找到"),
					$("#cont-profile-list").addClass("d-none")
				)
			)
		},
		
		closeSelectionProfileList=()=>{},
		
		remoteGetAstroAirProfilesReceivedError=(message,error)=>{
			errorFire(message+"<br>"+error,"成功获得设备列表")
		},
		
		document.querySelector("#profileListtBtn").addEventListener("click",e=>{
			getAstroAirProfiles()
		}),
		
		function getProfileName(){		//获取设备名称
			var Req={method:"RemoteGetEnvironmentData",params:{}};
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("getProfileName",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		//---------对焦------------
		
		document.querySelector("#goToPositionFocuser").addEventListener("click",e=>{
			let value=document.querySelector("#focuserPositionGoto").value;
			remoteFocuserMoveTo(value,!0,0)
		}),
		
		remoteFocuserMoveTo=(position,isAbsolute,direction)=>{
			var Req={method:"RemoteFocuserMoveTo",params:{}};
			Req.params.UID=generateUID(),
			Req.params.IsAbsoluteMove=isAbsolute,
			Req.params.NewPosition=position,
			Req.params.MoveDirection=direction,
			Req.params.IsBLCompensation=!1
			Req.params.BLCompVersus=0,
			Req.params.BLCompStep=0,
			Req.params.IsFinalPositionCheck=!0,
			Req.id=generateID(),
			pushUid(Req.method,Req.params.UID),
			doSend(JSON.stringify(Req))
		},
		
		autoFocusResultReceived=msg=>{
			1==msg.Done?populateFocusTable(msg):errorFire("AutoFocus error or not started correctly","Autofocus Error")
		},
		
		populateFocusTable=msg=>{
			let hfd=Math.round(100*(msg.HFD+Number.EPSILON))/100;
			addDataFocuser(hfd,msg.FilterIndex,msg.FilterColor,msg.FocusTemp),
			focusStatsArrayAdd(msg)
		},
		
		function focusStatsArrayAdd(data){
			focusStats.length<10?focusStats.unshift(data):(focusStats.pop(),focusStats.unshift(data)),
			updateFocusStatsTable()
		}

		function updateFocusStatsTable(){
			$(".focusStatItem").remove(),
			focusStats.forEach((element,i)=>{
				let index=9-i,
					hfd=Math.round(100*(element.HFD+Number.EPSILON))/100,
					temp=Math.round(100*(element.FocusTemp+Number.EPSILON))/100,
					percDev=Math.round(100*(element.PercDev+Number.EPSILON))/100,
					time=timeStampUtility(element.DoneTime).slice(0,8);
				$("#focusStatsUl").append('<li class="list-group-item bg-dark d-flex align-items-center justify-content-between focusStatItem px-2 py-1" id="focusItem'+index+'"><span class="info-data-item extraSmallText col m-0 p-0">'+time+'</span><span class="info-data-item extraSmallText col-2 m-0 p-0">'+hfd+'</span><span class="info-data-item extraSmallText col-2 m-0 p-0">'+cameraFilterList[element.FilterIndex]+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+temp+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+percDev+'</span><span class="info-data-item extraSmallText col m-0 p-0">'+element.Duration+"</span></li>")
			})
		}

		//---------自定义目标管理器------------
		
		function sendRemoteRoboClipGetTargetList(){
			var Req={method:"RemoteRoboClipGetTargetList",params:{}};
			Req.params.FilterName=roboClipNameTxt,
			Req.params.FilterGroup=roboClipGroupTxt,
			Req.params.FilterNote=roboClipNoteTxt,
			Req.params.Order=roboClipOrder,
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteRoboClipGetTargetList",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function RemoteRoboClipGetTargetListReceived(obj){
			roboClipTemp=obj.list;
			var dest="FOV",listarray=roboClipTemp;
			let containerUL=document.querySelector("#roboClipUL");
			listarray.length>0?(listarray.forEach((function(target){
				let elLi=document.createElement("li");
				elLi.classList="list-group-item bg-dark d-flex align-items-center roboClip-li",elLi.setAttribute("data-uid",target.guid);
				let col1=document.createElement("div");
				col1.classList="col";
				let span1=document.createElement("span");
				span1.classList="info-data-item rcNameList";
				let conName=document.createTextNode(target.targetname);
				span1.appendChild(conName),col1.appendChild(span1);
				let col2=document.createElement("div");
				col2.classList="col";
				let span2=document.createElement("span");
				span2.classList="info-data-item pr-1 rcRaList";
				let ra=document.createTextNode(coordinateFormat(target.raj2000,"h")),span3=document.createElement("span");
				span3.classList="info-data-item pl-1 rcDecList";
				let dec=document.createTextNode(coordinateFormat(target.decj2000,"º"));
				span3.appendChild(dec),span2.appendChild(ra),col2.appendChild(span2),col2.appendChild(span3);
				let isMosaic=JSON.parse(target.ismosaic),mosaTab=isMosaic?"["+target.frow+"x"+target.fcol+"]":"[NO]",col3=document.createElement("div");
				col3.classList="col-1",col3.setAttribute=target.tiles;
				let span34=document.createElement("span");
				span34.classList=isMosaic?"info-data-item px-1 rcPAlist text-danger":"info-data-item px-1 rcPAlist text-muted";
				let mos=document.createTextNode(mosaTab);
				span34.appendChild(mos),col3.appendChild(span34);
				let col4=document.createElement("div");col4.classList="col-1";
				let span4=document.createElement("span");
				span4.classList="info-data-item px-1 rcPAlist";
				let pa=document.createTextNode(target.pa);
				span4.appendChild(pa),col4.appendChild(span4);
				let col5=document.createElement("div");col5.classList="col";
				let span5=document.createElement("span");
				span5.classList="info-data-item rcGruppolist";
				let gruppo=document.createTextNode(target.gruppo);
				span5.appendChild(gruppo),col5.appendChild(span5);
				let col6=document.createElement("div");
				col6.classList="col d-none d-md-block";
				let span6=document.createElement("span");
				span6.classList="info-data-item rcNoteList";
				let note=document.createTextNode(target.note);
				span6.appendChild(note),col6.appendChild(span6);
				let col7=document.createElement("div");
				col7.classList="col";
				let btn1=document.createElement("button");
				btn1.classList="btn btn-sm btn-outline-success mx-1 flex-end px-2 py-1 btRoboClipLi",
					btn1.setAttribute("type","button"),
					btn1.setAttribute("name","get"),
					btn1.setAttribute("id",target.guid),
					btn1.setAttribute("data-dest",dest),
					btn1.setAttribute("title","Load target");
				let ico1=document.createElement("img");
				ico1.setAttribute("src","./img/paper-plane.png"),btn1.appendChild(ico1);
				let btn2=document.createElement("button");
				btn2.classList="btn btn-sm btn-outline-info mx-1 flex-end px-2 py-1 btRoboClipLi",
					btn2.setAttribute("type","button"),
					btn2.setAttribute("name","edit"),
					btn2.setAttribute("id",target.guid),
					btn2.setAttribute("data-dest",dest),
					btn2.setAttribute("title","Edit target");
				let ico2=document.createElement("img");
				ico2.setAttribute("src","./img/edit.png"),btn2.appendChild(ico2);
				let btn3=document.createElement("button");
				btn3.classList="btn btn-sm btn-outline-danger mx-1 flex-end px-2 py-1 btRoboClipLi",
					btn3.setAttribute("type","button"),
					btn3.setAttribute("name","del"),
					btn3.setAttribute("id",target.guid),
					btn3.setAttribute("data-dest",dest),
					btn3.setAttribute("title","Delete target");
				let ico3=document.createElement("img");
				ico3.setAttribute("src","./img/trash-alt.png"),btn3.appendChild(ico3);
				let btn4=document.createElement("button");
				btn4.classList="btn btn-sm btn-outline-orange mx-1 flex-end px-2 py-1 btRoboClipLi",
					btn4.setAttribute("type","button"),
					btn4.setAttribute("name","showTiles"),
					btn4.setAttribute("data-content",target.tiles),
					btn4.setAttribute("title","Show tiles list"),
					btn4.setAttribute("id",target.guid),
					btn4.setAttribute("data-dest",dest);
				let ico4=document.createElement("img");
				ico4.setAttribute("src","./img/showcsv.png"),
				btn4.appendChild(ico4),
				col7.appendChild(btn1),
				col7.appendChild(btn2),
				isMosaic&&col7.appendChild(btn4),
				col7.appendChild(btn3),
				elLi.appendChild(col1),
				elLi.appendChild(col2),
				elLi.appendChild(col3),
				elLi.appendChild(col4),
				elLi.appendChild(col5),
				elLi.appendChild(col6),
				elLi.appendChild(col7),
				containerUL.appendChild(elLi),
				roboClipGroup.includes(target.gruppo)||roboClipGroup.push(target.gruppo)
			})),
			updateGroupSelect()):rcFilterSelected?($("#roboClipUL").append('<li class="list-group-item bg-dark d-flex align-items-center roboClip-li"><div class="p-3 col"><p class="mt-2">Roboclip List Empty: nothing found. </p><p>Auto clear your Filter and Reload in<span class="text-primary ml-1" id="timerText"></span></p></div></li><li class="list-group-item bg-dark d-flex align-items-center roboClip-li"><div class="p-3 col"><progress class="m-2" value="0" max="10" id="progressBarReload"></progress></div></li>'),reloadAfterFilterSelectEmpty()):$("#roboClipUL").append('<li class="list-group-item bg-dark d-flex align-items-center roboClip-li"><div class="p-3 col">Roboclip List Empty. Insert and manage your first Target, try to get it from Virtual FOV.</div></li>'),rcFilterSelected
				||$("#filterText").val(""),
					$(".btRoboClipLi").click(actionButtonRoboClip),
					resetRcField(),
					$("#roboClipModal").modal("show"),
					setOrderButton()
		}
		
		function RemoteRoboClipGetTargetListReceivedError(mot,cod){
			errorFire(mot+" "+actionResultCodes[cod],"Remote action RoboClip error")
		}
		
		function updateGroupSelect(){
			var dropdown=$("#groupSelect");
			for(dropdown.empty(),dropdown.append('<option selected="true" disabled>Select Group</option>'),i=0;i<roboClipGroup.length;i++){
				var groupName=roboClipGroup[i];
				dropdown.append($("<option></option>").attr("value",groupName).text(groupName))
			}
			0==roboClipGroup.length&&dropdown.append($("<option></option>").attr("value","").text("No Group"))
		}

		function resetRcField(){
			$(".rcField").val(""),
			$("#ledMosaicRoboclip").text(""),
			document.getElementById("rcUid").value="",
			enableSaveDelBtn(!1)
		}
		
		function actionButtonRoboClip(event){
			var target=event.currentTarget;
			if("get"===target.name&&(rCgetCoordsAndPa(target.id,!0),showMosListPanel(!1)),"edit"===target.name&&(rCgetCoordsAndPa(target.id,!1),rCeditRow(target.id),showMosListPanel(!1)),"showTiles"===target.name&&showTiles(target.id),"del"===target.name){
				let targetObj,tempName;
				showMosListPanel(!1),
				modalDoubleWarnFire("Are you sure to remove target: "+roboClipTemp.find(x=>x.guid===target.id).targetname,"","delFromRoboClip",target.id)
			}
		}
		
		function resetOrderButtons(){
			$(".orderBtn").removeClass("btn-warning").addClass("btn-light")
		}
		
		function setOrderButton(){
			resetOrderButtons();
			var tempId="",textForOrderDesc="";
			switch(roboClipOrder){
				case 0:
					tempId="#orderDate",
					textForOrderDesc="Target list ordeded by Date Created Descendent";
					break;
				case 1:
					tempId="#orderName",
					textForOrderDesc="Target list ordeded by Name";
					break;
				case 2:
					tempId="#orderGroup",
					textForOrderDesc="Target list ordeded by Group";
					break;
				case 3:
					tempId="#orderRaDesc",
					textForOrderDesc="Target list ordeded by RA Descending";
					break;
				case 4:
					tempId="#orderRaAsc",
					textForOrderDesc="Target list ordeded by RA Ascending"
			}""!=tempId&&($(tempId).removeClass("btn-light").addClass("btn-warning"),$("#rcOrderDescr").text(textForOrderDesc))
		}

		function rCeditRow(uid){
			let targetObj=roboClipTemp.find(x=>x.guid===uid),
				tempName=targetObj.targetname,
				tempRa=coordinateFormat(targetObj.raj2000,"h"),
				tempDec=coordinateFormat(targetObj.decj2000,"º"),
				tempPa=targetObj.pa,
				tempNote=targetObj.note,
				group=targetObj.gruppo;
			$("#rcName").val(tempName),
			$("#raRc").val(tempRa),
			$("#decRc").val(tempDec),
			$("#paRc").val(tempPa,2),
			$("#rCnote").val(tempNote),
			chkIfMos()?$("#ledMosaicRoboclip").text("Mosaic ["+mosaicSettings.Hnum+"x"+mosaicSettings.Wnum+"]"):$("#ledMosaicRoboclip").text(""),document.getElementById("rcUid").value=uid;
			let indexGroup=roboClipGroup.findIndex(x=>x===group);
			document.getElementById("groupSelect").selectedIndex=indexGroup+1,
			showRcAlert("#rcSuccess","You are now editing an this Target: "+tempName),
			enableSaveDelBtn(!0)
		}
		
		function rCdelRow(uid){
			remoteRoboClipRemoveTarget(uid)
		}
		
		function remoteRoboClipRemoveTarget(guid){
			var Req={method:"RemoteRoboClipRemoveTarget",params:{}};
			Req.params.RefGuidTarget=guid,
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteRoboClipRemoveTarget",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function remoteRoboClipRemoveTargetOkReceived(param){
			$(".roboClip-li").remove(),
			$("#ledMosaicRoboclip").text(""),
			$("#groupSelect").find("option").remove().end().append('<option selected="true" disabled>Select Group</option>'),
			roboClipGroup=[],
			roboClipTemp=[],
			sendRemoteRoboClipGetTargetList(),
			showRcAlert("#rcSuccess","Target Removed "+param.ret),
			resetRcField()
		}
		
		function remoteRoboClipRemoveTargetReceivedError(mot,cod){
			errorFire(mot+" "+actionResultCodes[cod],"Remote action RoboClip Delete Target error")
		}
		
		function remoteRoboClipUpdateTarget(guid){
			let name=$("#rcName").val(),ra=$("#raRc").val();
			ra=convertRainDecimal(ra)/15;
			let dec=$("#decRc").val();dec=convertDecinDecimal(dec);
			let pa=$("#paRc").val(),note=$("#rCnote").val(),gruppo=$("#groupSelect").val(),newgroup=$("#newGroup").val(),col=mosaicSettings.Wnum,row=mosaicSettings.Hnum,isMos=col>1||row>1,overlap=mosaicSettings.Overlap,angleAdjust=mosaicSettings.angleAdj;
			null!=gruppo&&""!=gruppo||(gruppo=newgroup);
			var Req={method:"RemoteRoboClipUpdateTarget",params:{}};
			Req.params.RefGuidTarget=guid,
			Req.params.TargetName=name,
			Req.params.RAJ2000=parseFloat(ra),
			Req.params.DECJ2000=parseFloat(dec),
			Req.params.PA=parseFloat(pa),
			Req.params.Group=gruppo,
			Req.params.Note=note,
			Req.params.IsMosaic=isMos,
			Req.params.FROW=parseInt(row),
			Req.params.FCOL=parseInt(col),
			Req.params.overlap=overlap,
			Req.params.angleAdj=angleAdjust,
			Req.params.TILES=isMos?getMosaicCsvText():"",
			Req.params.DX=fovdata.DX,
			Req.params.DY=fovdata.DY,
			Req.params.PixelSize=fovdata.pixsize,
			Req.params.Focallen=fovdata.focal,
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteRoboClipUpdateTarget",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function remoteRoboClipUpdateTargetOkReceived(param){
			$(".roboClip-li").remove(),
			$("#ledMosaicRoboclip").text(""),
			$("#groupSelect").find("option").remove().end().append('<option selected="true" disabled>Select Group</option>'),
			roboClipGroup=[],
			roboClipTemp=[],
			resetRcField(),
			sendRemoteRoboClipGetTargetList(),
			showRcAlert("#rcSuccess","Target Updated "+param.ret)
		}
		
		function remoteRoboClipUpdateTargetReceivedError(mot,cod){
			errorFire(mot+" "+actionResultCodes[cod],"Remote action RoboClip Update Target error")
		}
		
		function remoteRoboClipAddTarget(guid){
			let name=$("#rcName").val(),ra=$("#raRc").val();
			ra=convertRainDecimal(ra)/15;
			let dec=$("#decRc").val();
			dec=convertDecinDecimal(dec);
			let pa=$("#paRc").val(),note=$("#rCnote").val(),gruppo=$("#groupSelect").val(),newgroup=$("#newGroup").val(),col=mosaicSettings.Wnum,row=mosaicSettings.Hnum,isMos=col>1||row>1,overlap=mosaicSettings.Overlap,angleAdjust=mosaicSettings.angleAdj;
			null!=gruppo&&""!=gruppo||(gruppo=newgroup);
			var Req={method:"RemoteRoboClipAddTarget",params:{}};
			Req.params.GuidTarget=guid,
			Req.params.TargetName=name,
			Req.params.RAJ2000=parseFloat(ra),
			Req.params.DECJ2000=parseFloat(dec),
			Req.params.PA=parseFloat(pa),
			Req.params.Group=gruppo,
			Req.params.Note=note,
			Req.params.IsMosaic=isMos,
			Req.params.FROW=parseInt(row),
			Req.params.FCOL=parseInt(col),
			Req.params.overlap=overlap,
			Req.params.angleAdj=angleAdjust,
			Req.params.TILES=isMos?getMosaicCsvText():"",
			Req.params.DX=fovdata.DX,
			Req.params.DY=fovdata.DY,
			Req.params.PixelSize=fovdata.pixsize,
			Req.params.Focallen=fovdata.focal,
			Req.params.UID=generateUID(),
			Req.id=generateID(),
			pushUid("RemoteRoboClipAddTarget",Req.params.UID),
			doSend(JSON.stringify(Req))
		}
		
		function remoteRoboClipAddTargetOkReceived(param){
			$(".roboClip-li").remove(),
			$("#ledMosaicRoboclip").text(""),
			$("#groupSelect").find("option").remove().end().append('<option selected="true" disabled>Select Group</option>'),
			roboClipGroup=[],
			roboClipTemp=[],
			resetRcField(),
			sendRemoteRoboClipGetTargetList(),
			showRcAlert("#rcSuccess","Target Added Successiful! "+param.ret)
		}
		
		function remoteRoboClipAddTargetReceivedError(mot,cod){
			errorFire(mot+" "+actionResultCodes[cod],"Remote action RoboClip Add New Target error")
		}
		
		function showRcAlert(id,msg){
			$(id+" p").text(msg),
			$(id).show(300),
			$(id).delay(3e3).hide(300)
		}
		
		function showRcAlertAndRemain(id,msg){
			$(id+" p").text(msg),
			$(id).show(300)
		}
		
		function enableSaveDelBtn(condition){
			let rcUid=$("#rcUid").val();
			condition&&""!==rcUid?(setBtnActive("#deleteFormRc"),
			setBtnActive("#saveFormRc"),
			$(".rcField").prop("disabled",!condition)):""==rcUid&&(setBtnNotActive("#deleteFormRc"),setBtnNotActive("#saveFormRc"),$(".rcField").prop("disabled",!condition))
		}
		
		$("#alaRoboClipbtn").click((function(){
			resetRcField(),
			resetFilterCont(),
			sendRemoteRoboClipGetTargetList()
		})),
		
		$("#roboClipModal").on("hide.bs.modal",(function(){
			showMosListPanel(!1)
		})),
		
		$("#roboClipModal").on("hidden.bs.modal",(function(){
			$(".roboClip-li").remove(),
			$("#ledMosaicRoboclip").text(""),
			$("#groupSelect").find("option").remove().end().append('<option selected="true" disabled>Select Group</option>'),
			roboClipGroup=[],
			roboClipTemp=[],
			roboClipOrder=0,
			resetRcField(),
			enableSaveDelBtn(!1)
		})),

		$("#clearFormRc").click(resetRcField),showTiles=uid=>{
			let targetObj=roboClipTemp.find(x=>x.guid===uid),csvList=targetObj.tiles,tempArray=csvToArray(csvList);
			setClipboardMosList(csvList),
			tempArray.unshift(["Tile name","RAJ2000","DECJ2000","PA"]);
			let cont=document.querySelector("#csvListDiv"),nameStr=targetObj.targetname;
			const namecont=document.querySelector("#mosListTargetName");
			namecont.innerText=nameStr,cont.textContent="";
			let tbl=document.createElement("table");
			tbl.classList="mount-panel-item",tbl.style.width="100%",tbl.setAttribute("border","1");
			let tbdy=document.createElement("tbody");
			tempArray.forEach((function(row){
				let tr=document.createElement("tr");
				row.forEach((function(cell){
					let td=document.createElement("td");
					td.classList="p-1",td.appendChild(document.createTextNode(cell)),tr.appendChild(td)
				})),
				tbdy.appendChild(tr)
			})),
			tbl.appendChild(tbdy),
			cont.appendChild(tbl),
			showMosListPanel(!0)
		},
		
		rCgetCoordsAndPa=(uid,loading=!0)=>{
			let isLoading=loading,targetObj=roboClipTemp.find(x=>x.guid===uid),tempRa=targetObj.raj2000,tempDec=targetObj.decj2000,tempPa=targetObj.pa,tempName=targetObj.name,ismosaic=JSON.parse(targetObj.ismosaic),fcol=targetObj.fcol,frow=targetObj.frow,overlap=targetObj.overlap,angleadj=JSON.parse(targetObj.angleadj),focallen=targetObj.focallen,pixelsize=targetObj.pixelsize,dx=targetObj.dx,dy=targetObj.dy;
			if(aladin.gotoRaDec(15*tempRa,tempDec),
				getCoordinateAladin(),
				$("#fdb-pAng").val(tempPa),
				$("#paInd").text(" "+tempPa+"°"),
				changePAng(tempPa),$("#inputsearch").val(""),
				isLoading&&$("#roboClipModal").modal("hide"),
				ismosaic){
					let obj={};
					obj.DX=dx,obj.DY=dy,
					obj.Focallen=focallen,
					obj.PixelSize=pixelsize,
					obj.PA=tempPa,
					addFovMosaicLoaded(obj),
					setNewValuesMosaic(frow,fcol,overlap,angleadj),
					setTimeout(vFoVStart,500)
				}else 
					resetMosaic()
		},
		
		$("#orderDate").removeClass("btn-light").addClass("btn-warning"),
		
		$(".orderBtn").on("click",(function(e){
			let param=parseInt(this.getAttribute("data-param"));
			param!=roboClipOrder&&($("#roboClipModal").modal("hide"),setTimeout((function(){
				roboClipOrder=param,
				sendRemoteRoboClipGetTargetList()
			}),500))
		})),
		
		$("#newFormRc").click((function(){
			resetRcField();
			let guid=generateUID();
			$("#rcUid").val(guid),enableSaveDelBtn(!0)
		})),
		
		$("#saveFormRc").click((function(){
			let guid=$("#rcUid").val(),tempRa=$("#raRc").val();
			if(""!=guid){
				let targetObj;
				null!=roboClipTemp.find(x=>x.guid===guid)?remoteRoboClipUpdateTarget(guid):""!=tempRa?remoteRoboClipAddTarget(guid):showRcAlert("#rcWarning","Please insert coords"),
				preResetFilters(),
				roboClipOrder=0
			}
		})),
		
		$("#deleteFormRc").click((function(){
			let rcUid=$("#rcUid").val();
			if(""!=rcUid){
				let targetObj=roboClipTemp.find(x=>x.guid===rcUid);
				if(null!=targetObj){
					let tempName;modalDoubleWarnFire("Are you sure to remove target: "+targetObj.targetname,"","delFromRoboClip",rcUid)
				}else 
					showRcAlert("#rcWarning","Cannot Delete Target Before Save it.")
			}else 
				showRcAlert("#rcWarning","Select a Target from the list above.")
		})),
		
		$("#filterMenuSelId").children().click((function(){
			executeFilterApp(this.innerText)
		})),
		
		$("#clear-btn-id").click(resetFilterCont),
		
		$("#applyFilterBtn").click((function(){
			rcFilterActivation()
		})),
		
		getMosaicCsvText=()=>{
			let csvStr="";
			for(var i=0;i<mosaicTiles.length;i++){
				var line="PANE "+(i+1);line+=";",line+=mosaicTiles[i].raHours,line+=";",line+=mosaicTiles[i].decDegr,line+=";",csvStr+=(line+=mosaicTiles[i].singlePA)+"\r\n"
			}
			return csvStr
		},
		
		csvToArray=csv=>{
			var resultArray=[];
			return csv.split("\n").forEach((function(row){
				var rowArray=[];
				row.split(";").forEach((function(cell){
					rowArray.push(cell)
				})),
				""!=rowArray&&resultArray.push(rowArray)
			})),resultArray
		},
		
		createTableFromArray=arr=>{
			let tempArray,content="";
			return arr.forEach((function(row){
				content+="<tr>",row.forEach((function(cell){
					content+="<td>"+cell+"</td>"
				})),
				content+="</tr>"
			})),
			content
		},
		
		r2d=radians=>{
			let pi;
			return radians*(180/Math.PI)
		},
		
		d2r=degrees=>{
			let pi;
			return degrees*(Math.PI/180)
		},
		
		calculateSingleRot=abs=>{
			let res,abs2={};
			abs2.y=abs.y-.1;
			let p1=aladin.pix2world(abs.x,abs.y),p2=aladin.pix2world(abs.x,abs2.y);
			p1[0]=d2r(p1[0]),p1[1]=d2r(p1[1]),p2[0]=d2r(p2[0]),p2[1]=d2r(p2[1]);
			let L=p2[0]-p1[0];
			return res=Math.atan2(Math.sin(L),Math.cos(p1[1])*Math.tan(p2[1])-Math.sin(p1[1])*Math.cos(L)),res=r2d(res),res
		};
		
		chkIfMos=()=>{
			let isMos;
			return mosaicSettings.Wnum>1||mosaicSettings.Hnum>1
		},
		
		moreInfoRotAdjXp=()=>{
			$("#moreInfoRotBtn").html((function(){
				var collapse="More info about Rotation adjust",expand="Close info";
				return $("#rotationAdjDesc").is(":visible")?collapse:expand}))
		},
		
		showMosListPanel=bool=>{
			bool?$("#csvListCont, #csvCard").removeClass("offscreen"):$("#csvListCont, #csvCard").addClass("offscreen")
		},

		stopConnectingStatusForAbort=()=>{}
		
		//----------终止-----------
		
		function abortHaltAll(isHalt){		//终止全部
			var Req={method:"Abort",params:{}};
			Req.params.IsHalt=isHalt,
			Req.id=generateID(),
			doSend(JSON.stringify(Req)),
			remoteSetupBtnResetAbort()
		}

		function modalDoubleWarnFire(message,title,ident,param){		//显示提示信息防止误操作
			""==title&&(title="确认操作？"),""==message&&(message="是否真的确认您的操作？"),
			$("#contWarnModal").html(message),
			$("#modalWarnTit").html(title),
			$("#confirmDoubleWarn").off(),
			$("#confirmDoubleWarn").on("click",e=>{doubConfSecStep(ident,param)}),
			$("#modalDoubleWarning").modal("show")
		}
		
		var btnDub=document.querySelectorAll(".doubleConfirm");
		btnDub.forEach(item=>{
			item.addEventListener("click",e=>{
				doubleConfirmAction(e.currentTarget)
			})
		}),
		
		doubleConfirmAction=t=>{		//操作确认
			""!=t.id?modalDoubleWarnFire(t.innerHTML,t.value,t.id):errorFire("发送前确认操作出错，id为空。请向开发者汇报.","操作命令发送错误.")
		},

		doubConfSecStep=(id,param)=>{		//判断停止事件类型
			switch($("#modalDoubleWarning").modal("hide"),id){
				case"abortAllBtn":
					case"seqAbortBtn":
						case"dragAbortBtn":
							abortHaltAll(!1);		//全部停止
					break;
				case"haltMontBtn":
					case"haltAllBtn":
						abortHaltAll(!0);		//停止当前动作
					break;
				case"remoteShotAbortbtn":
					abortRemoteAction(tempUIDshot);			//停止拍摄
					break;
				case"disconnectBtn":
					closeconn();		//断开连接
					break;
				case"startupDisConn":
					startupDisconnectionReq();		//与设备断开连接
					break;
				case"delFromRoboClip":
					rCdelRow(param);
					break;
				case"resetLocalStorage":
					resetLocalStorageData();		//重置本地存储
					break;
				default:errorFire("没有分配给此按钮的操作.")
			}
		}

		

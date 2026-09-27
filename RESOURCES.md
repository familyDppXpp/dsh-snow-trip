# 消息渲染课程的一手资料

本课依据本机实际源码，不将结论外推为所有未来 DSH 版本。

宿主提交：`952e68cfa0`。

- [问答工具：等待人类回答，再返回 JSON 文本](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/interaction/tool-ask-user/src/index.ts)
- [会话绑定：订阅事件窗口，增量更新或重建](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-conversation/src/client/conversation/assembly.ts)
- [节点定义契约：match / start / update / buildViewNode](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-conversation/src/client/contract/conversation.ts)
- [节点装配：验证 key 与 target](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-conversation/src/client/conversation/assembler.ts)
- [普通助手消息：流式更新与最终消息](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/assistant.ts)
- [普通工具节点：直接读取 message.content](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/tool.ts)
- [聊天槽位：按 node.kind 选择组件](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx)
- [待回答问题：注册到输入区](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-user-questions/src/client/index.ts)
- [插件问答记录定义](/Users/liuyunxia/Documents/dsh/huaxue/src/package-turns.js)
- [插件注册事件定义与渲染器](/Users/liuyunxia/Documents/dsh/huaxue/src/client.jsx)
- [只读问答记录组件](/Users/liuyunxia/Documents/dsh/huaxue/src/package-cards.jsx)
- [会话界面槽位完整契约](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-conversation/src/client/contract/slots.ts)
- [会话内容工厂实现](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationContent.tsx)
- [Chat 视图注册与注入](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-chat/src/client/apply.ts)
- [工具视图按工具名路由](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-tool/src/client/tool/ToolCallTree.tsx)
- [各 target 视图注册器](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-conversation/src/client/conversation/view-registry.ts)

import api from '../lib/api-client';
const mockFetch=jest.fn();
beforeEach(()=>{global.fetch=mockFetch;mockFetch.mockReset();});
test('unwraps task mutations and parses agent configuration',async()=>{
 mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({success:true,data:{id:'task',agent:{config:'{"maxTokens":100}'}}})});
 expect(await api.updateTask('task',{title:'updated'})).toEqual({id:'task',agent:{config:{maxTokens:100}}});
});
test('sends explicit nulls to unassign a task',async()=>{
 mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({success:true,data:{id:'task'}})});
 await api.assignTask('task');
 expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({assigneeId:null,agentId:null});
});
test('surfaces API validation messages',async()=>{
 mockFetch.mockResolvedValue({ok:false,status:400,json:async()=>({error:'Task is blocked'})});
 await expect(api.startAgent('agent','task')).rejects.toThrow('Task is blocked');
});

const nextJest=require('next/jest');
module.exports=nextJest({dir:'./'})({
 testEnvironment:'jsdom',testMatch:['<rootDir>/tests/**/*.test.ts','<rootDir>/tests/**/*.test.tsx'],
 setupFilesAfterEnv:['<rootDir>/tests/setup.ts'],
});

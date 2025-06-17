@echo off
echo Starting Hardhat deployment...
echo.
echo Make sure Hardhat node is running in another terminal!
echo (Run: npx hardhat node)
echo.
pause
echo.
echo Deploying all contracts...
call npx hardhat run scripts/deploy_all.js --network localhost
echo.
echo Deployment complete!
echo Check src/config.json for deployed addresses.
echo.
echo Now you can start the React app with: npm start
pause
